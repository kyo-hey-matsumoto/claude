import { currencyDecimals, toMinorUnits } from "@livapon/domain";

const GET_REFUNDABLE_TRANSACTION_QUERY = `
query GetRefundableTransaction($orderId: ID!) {
  order(id: $orderId) {
    id
    transactions(first: 50) {
      id
      kind
      status
      gateway
    }
  }
}
`;

const GET_ORDER_REFUNDED_LINE_ITEMS_QUERY = `
query GetOrderRefundedLineItems($orderId: ID!) {
  order(id: $orderId) {
    id
    refunds(first: 50) {
      refundLineItems(first: 50) {
        edges {
          node {
            lineItem {
              id
            }
            subtotalSet {
              presentmentMoney {
                amount
              }
            }
          }
        }
      }
    }
  }
}
`;

const CREATE_REFUND_MUTATION = `
mutation CreateBookingRefund($input: RefundInput!, $idempotencyKey: String!) {
  refundCreate(input: $input) @idempotent(key: $idempotencyKey) {
    refund {
      id
      totalRefundedSet {
        presentmentMoney {
          amount
          currencyCode
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}
`;

const FIND_CUSTOMER_BY_EMAIL_QUERY = `
query FindCustomerByEmail($query: String!) {
  customers(first: 1, query: $query) {
    edges {
      node {
        id
      }
    }
  }
}
`;

const CUSTOMER_UPSERT_FIELDS = `
    customer {
      id
    }
    userErrors {
      field
      message
    }
`;

const CREATE_CUSTOMER_MUTATION = `
mutation CreateRaffleCustomer($input: CustomerInput!) {
  customerCreate(input: $input) {
${CUSTOMER_UPSERT_FIELDS}
  }
}
`;

const UPDATE_CUSTOMER_MUTATION = `
mutation UpdateRaffleCustomer($input: CustomerInput!) {
  customerUpdate(input: $input) {
${CUSTOMER_UPSERT_FIELDS}
  }
}
`;

// A capture with no prior authorization is recorded as SALE. Prefer CAPTURE
// (settles an existing authorization) when both are present.
const REFUNDABLE_TRANSACTION_KIND_PRIORITY = ["CAPTURE", "SALE"];

type OrderTransaction = {
  id: string;
  kind: string;
  status: string;
  gateway: string;
};

type GetRefundableTransactionResponse = {
  data?: {
    order?: {
      transactions: OrderTransaction[];
    } | null;
  };
  errors?: Array<{ message: string }>;
};

type CreateRefundResponse = {
  data?: {
    refundCreate?: {
      refund?: {
        id: string;
        totalRefundedSet: { presentmentMoney: { amount: string; currencyCode: string } };
      } | null;
      userErrors: Array<{ field?: string[] | null; message: string }>;
    };
  };
  errors?: Array<{ message: string }>;
};

type GetOrderRefundedLineItemsResponse = {
  data?: {
    order?: {
      refunds: Array<{
        refundLineItems: {
          edges: Array<{ node: { lineItem: { id: string } | null; subtotalSet: { presentmentMoney: { amount: string } } } }>;
        };
      }>;
    } | null;
  };
  errors?: Array<{ message: string }>;
};

type FindCustomerByEmailResponse = {
  data?: { customers?: { edges: Array<{ node: { id: string } }> } };
  errors?: Array<{ message: string }>;
};

type CustomerUpsertResult = { customer?: { id: string } | null; userErrors: Array<{ field?: string[] | null; message: string }> };

type CustomerUpsertResponse = {
  data?: {
    customerCreate?: CustomerUpsertResult;
    customerUpdate?: CustomerUpsertResult;
  };
  errors?: Array<{ message: string }>;
};

export type RaffleCustomerInput = {
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  dateOfBirth?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  marketingOptIn: boolean;
};

type TokenExchangeResponse = { access_token?: string };

export class ShopifyAdminClient {
  private readonly storeDomain: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly apiVersion: string;
  private readonly fetcher: typeof fetch;
  // Memoized per instance only (not across requests): this app is a Dev
  // Dashboard "merchant custom app" using the client credentials grant, which
  // has no static Admin API access token to store in env — a fresh access
  // token is fetched via clientId/clientSecret instead. A new ShopifyAdminClient
  // is constructed per refund request (matching this codebase's existing
  // per-call Shopify client convention), so this cache only avoids fetching
  // the token twice within a single refund's two GraphQL calls.
  private accessTokenPromise: Promise<string> | null = null;

  constructor(input: { storeDomain: string; clientId: string; clientSecret: string; apiVersion?: string; fetcher?: typeof fetch }) {
    this.storeDomain = normalizeStoreDomain(input.storeDomain);
    this.clientId = input.clientId;
    this.clientSecret = input.clientSecret;
    this.apiVersion = input.apiVersion ?? "2026-04";
    this.fetcher = input.fetcher ?? fetch;
  }

  /**
   * Finds the transaction to refund against. A cancellation refund is a
   * partial-amount monetary refund (driven by the cancellation fee schedule),
   * not tied to specific line items, so it targets the order's settled
   * SALE/CAPTURE transaction directly via `transactions` rather than
   * `refundLineItems`.
   */
  async getRefundableTransaction(orderGid: string): Promise<{ id: string; gateway: string } | null> {
    const payload = await this.request<GetRefundableTransactionResponse>(GET_REFUNDABLE_TRANSACTION_QUERY, {
      orderId: orderGid
    });

    const transactions = payload.data?.order?.transactions ?? [];
    const successful = transactions.filter((transaction) => transaction.status === "SUCCESS");

    for (const kind of REFUNDABLE_TRANSACTION_KIND_PRIORITY) {
      const match = successful.find((transaction) => transaction.kind === kind);
      if (match) {
        return { id: match.id, gateway: match.gateway };
      }
    }

    return null;
  }

  /**
   * Cumulative refunded amount per line item across every refund ever issued
   * on the order — not just the refund that triggered the current webhook.
   * A refund split across multiple separate Shopify Admin actions (e.g. 60%
   * today, the remaining 40% later) only becomes visible as "fully refunded"
   * when read this way; a single refunds/create webhook payload only ever
   * shows its own slice.
   */
  async getRefundedAmountsByLineItem(orderGid: string, currencyCode: string): Promise<Map<string, number>> {
    const payload = await this.request<GetOrderRefundedLineItemsResponse>(GET_ORDER_REFUNDED_LINE_ITEMS_QUERY, {
      orderId: orderGid
    });

    const amounts = new Map<string, number>();
    const refunds = payload.data?.order?.refunds ?? [];

    for (const refund of refunds) {
      for (const edge of refund.refundLineItems.edges) {
        const lineItemGid = edge.node.lineItem?.id;
        if (!lineItemGid) {
          continue;
        }
        const cents = toMinorUnits(edge.node.subtotalSet.presentmentMoney.amount, currencyCode);
        amounts.set(lineItemGid, (amounts.get(lineItemGid) ?? 0) + cents);
      }
    }

    return amounts;
  }

  async createRefund(input: {
    orderGid: string;
    amount: number;
    currencyCode: string;
    parentTransactionId: string;
    gateway: string;
    note?: string;
    idempotencyKey: string;
  }): Promise<{ refundGid: string; totalRefundedAmount: number; currencyCode: string }> {
    const payload = await this.request<CreateRefundResponse>(CREATE_REFUND_MUTATION, {
      input: {
        orderId: input.orderGid,
        note: input.note,
        transactions: [
          {
            orderId: input.orderGid,
            amount: input.amount.toFixed(currencyDecimals(input.currencyCode)),
            gateway: input.gateway,
            kind: "REFUND",
            parentId: input.parentTransactionId
          }
        ]
      },
      idempotencyKey: input.idempotencyKey
    });

    const refundCreate = payload.data?.refundCreate;
    if (refundCreate?.userErrors.length) {
      throw new Error(refundCreate.userErrors.map((error) => error.message).join(", "));
    }

    const refund = refundCreate?.refund;
    if (!refund) {
      throw new Error("Shopify Admin refundCreate did not return a refund");
    }

    return {
      refundGid: refund.id,
      totalRefundedAmount: Number(refund.totalRefundedSet.presentmentMoney.amount),
      currencyCode: refund.totalRefundedSet.presentmentMoney.currencyCode
    };
  }

  /**
   * Upserts a raffle entrant as a Shopify customer for later marketing use
   * (spec §5). Standard fields map to native customer fields; gender/date of
   * birth have no native customer field so they are stored as `raffle`
   * namespace metafields. Never called from inside a DB transaction — callers
   * treat this as a slow, best-effort side effect (see RaffleShopifySyncService).
   */
  async upsertRaffleCustomer(input: RaffleCustomerInput): Promise<string> {
    const existingId = await this.findCustomerIdByEmail(input.email);
    const customerInput = this.buildRaffleCustomerInput(input, existingId);

    const mutation = existingId ? UPDATE_CUSTOMER_MUTATION : CREATE_CUSTOMER_MUTATION;
    const payload = await this.request<CustomerUpsertResponse>(mutation, { input: customerInput });
    const result = existingId ? payload.data?.customerUpdate : payload.data?.customerCreate;

    if (result?.userErrors.length) {
      throw new Error(result.userErrors.map((error) => error.message).join(", "));
    }
    if (!result?.customer) {
      throw new Error("Shopify Admin customer upsert did not return a customer");
    }
    return result.customer.id;
  }

  private async findCustomerIdByEmail(email: string): Promise<string | null> {
    const payload = await this.request<FindCustomerByEmailResponse>(FIND_CUSTOMER_BY_EMAIL_QUERY, {
      query: `email:${JSON.stringify(email)}`
    });
    return payload.data?.customers?.edges[0]?.node.id ?? null;
  }

  private buildRaffleCustomerInput(input: RaffleCustomerInput, existingId: string | null) {
    const metafields = [
      input.gender ? { namespace: "raffle", key: "gender", type: "single_line_text_field", value: input.gender } : null,
      input.dateOfBirth ? { namespace: "raffle", key: "date_of_birth", type: "date", value: input.dateOfBirth } : null
    ].filter((metafield): metafield is NonNullable<typeof metafield> => metafield !== null);

    return {
      id: existingId ?? undefined,
      email: input.email,
      phone: input.phone,
      firstName: input.firstName,
      lastName: input.lastName,
      addresses:
        input.addressLine1 || input.city
          ? [
              {
                address1: input.addressLine1,
                address2: input.addressLine2,
                city: input.city,
                province: input.region,
                zip: input.postalCode,
                country: input.country
              }
            ]
          : undefined,
      emailMarketingConsent: {
        marketingState: input.marketingOptIn ? "SUBSCRIBED" : "NOT_SUBSCRIBED",
        marketingOptInLevel: "SINGLE_OPT_IN",
        consentUpdatedAt: new Date().toISOString()
      },
      metafields: metafields.length ? metafields : undefined
    };
  }

  private async getAccessToken(): Promise<string> {
    if (!this.accessTokenPromise) {
      this.accessTokenPromise = this.fetchAccessToken();
    }
    return this.accessTokenPromise;
  }

  // Client credentials grant (RFC 6749 §4.4): trusted server-to-server
  // exchange, no end-user/redirect involved. Only valid for apps owned by the
  // same Dev Dashboard organization as the store — see Shopify's
  // "shop_not_permitted" troubleshooting note if this ever starts failing.
  private async fetchAccessToken(): Promise<string> {
    const response = await this.fetcher(`https://${this.storeDomain}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.clientId,
        client_secret: this.clientSecret
      }).toString()
    });

    if (!response.ok) {
      throw new Error(`Shopify Admin API token exchange failed: ${response.status}`);
    }

    const payload = (await response.json()) as TokenExchangeResponse;
    if (!payload.access_token) {
      throw new Error("Shopify Admin API token exchange did not return an access_token");
    }
    return payload.access_token;
  }

  private async request<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const accessToken = await this.getAccessToken();
    const response = await this.fetcher(`https://${this.storeDomain}/admin/api/${this.apiVersion}/graphql.json`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Shopify-Access-Token": accessToken
      },
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      throw new Error(`Shopify Admin API request failed: ${response.status}`);
    }

    const payload = (await response.json()) as T & { errors?: Array<{ message: string }> };
    if (payload.errors?.length) {
      throw new Error(`Shopify Admin API error: ${payload.errors.map((error) => error.message).join(", ")}`);
    }

    return payload;
  }
}

function normalizeStoreDomain(storeDomain: string) {
  return storeDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
