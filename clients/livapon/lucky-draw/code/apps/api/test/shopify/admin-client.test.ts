import { describe, expect, it, vi } from "vitest";
import { ShopifyAdminClient } from "../../src/shopify/admin-client.js";

const TOKEN_RESPONSE = {
  ok: true,
  json: async () => ({ access_token: "shpat_test-token", scope: "read_orders,write_orders", expires_in: 86399 })
};

function stubFetcher(graphqlResponse: unknown) {
  return vi.fn(async (url: string) => {
    if (String(url).includes("/admin/oauth/access_token")) {
      return TOKEN_RESPONSE;
    }
    return graphqlResponse;
  });
}

function makeClient(fetcher: unknown) {
  return new ShopifyAdminClient({
    storeDomain: "livapon-dev.myshopify.com",
    clientId: "client-id-abc",
    clientSecret: "client-secret-xyz",
    fetcher: fetcher as never
  });
}

describe("ShopifyAdminClient — client credentials token exchange", () => {
  it("exchanges clientId/clientSecret for an access token before the GraphQL call", async () => {
    const fetcher = stubFetcher({
      ok: true,
      json: async () => ({ data: { order: { id: "gid://shopify/Order/1", transactions: [] } } })
    });
    const client = makeClient(fetcher);

    await client.getRefundableTransaction("gid://shopify/Order/1");

    expect(fetcher).toHaveBeenCalledTimes(2);
    const [tokenUrl, tokenInit] = fetcher.mock.calls[0];
    expect(tokenUrl).toBe("https://livapon-dev.myshopify.com/admin/oauth/access_token");
    expect(tokenInit.headers["content-type"]).toBe("application/x-www-form-urlencoded");
    const body = new URLSearchParams(tokenInit.body);
    expect(body.get("grant_type")).toBe("client_credentials");
    expect(body.get("client_id")).toBe("client-id-abc");
    expect(body.get("client_secret")).toBe("client-secret-xyz");

    const [graphqlUrl, graphqlInit] = fetcher.mock.calls[1];
    expect(graphqlUrl).toBe("https://livapon-dev.myshopify.com/admin/api/2026-04/graphql.json");
    expect(graphqlInit.headers["X-Shopify-Access-Token"]).toBe("shpat_test-token");
  });

  it("only fetches the token once across two calls on the same client instance", async () => {
    const fetcher = stubFetcher({
      ok: true,
      json: async () => ({ data: { order: { id: "gid://shopify/Order/1", transactions: [] } } })
    });
    const client = makeClient(fetcher);

    await client.getRefundableTransaction("gid://shopify/Order/1");
    await client.getRefundableTransaction("gid://shopify/Order/1");

    const tokenCalls = fetcher.mock.calls.filter(([url]) => String(url).includes("/admin/oauth/access_token"));
    expect(tokenCalls).toHaveLength(1);
  });

  it("throws when the token exchange itself fails", async () => {
    const fetcher = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    const client = makeClient(fetcher);

    await expect(client.getRefundableTransaction("gid://shopify/Order/1")).rejects.toThrow(
      "Shopify Admin API token exchange failed: 401"
    );
  });

  it("throws when the token exchange response has no access_token", async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ scope: "read_orders" }) }));
    const client = makeClient(fetcher);

    await expect(client.getRefundableTransaction("gid://shopify/Order/1")).rejects.toThrow(
      "Shopify Admin API token exchange did not return an access_token"
    );
  });
});

describe("ShopifyAdminClient", () => {
  describe("getRefundableTransaction", () => {
    it("returns the successful SALE/CAPTURE transaction id and gateway", async () => {
      const fetcher = stubFetcher({
        ok: true,
        json: async () => ({
          data: {
            order: {
              id: "gid://shopify/Order/1",
              transactions: [
                { id: "gid://shopify/OrderTransaction/1", kind: "AUTHORIZATION", status: "SUCCESS", gateway: "shopify_payments" },
                { id: "gid://shopify/OrderTransaction/2", kind: "SALE", status: "SUCCESS", gateway: "shopify_payments" }
              ]
            }
          }
        })
      });
      const client = makeClient(fetcher);

      const result = await client.getRefundableTransaction("gid://shopify/Order/1");

      expect(result).toEqual({ id: "gid://shopify/OrderTransaction/2", gateway: "shopify_payments" });
    });

    it("prefers CAPTURE over a plain AUTHORIZATION", async () => {
      const fetcher = stubFetcher({
        ok: true,
        json: async () => ({
          data: {
            order: {
              id: "gid://shopify/Order/1",
              transactions: [
                { id: "gid://shopify/OrderTransaction/1", kind: "AUTHORIZATION", status: "SUCCESS", gateway: "shopify_payments" },
                { id: "gid://shopify/OrderTransaction/2", kind: "CAPTURE", status: "SUCCESS", gateway: "shopify_payments" }
              ]
            }
          }
        })
      });
      const client = makeClient(fetcher);

      const result = await client.getRefundableTransaction("gid://shopify/Order/1");

      expect(result).toEqual({ id: "gid://shopify/OrderTransaction/2", gateway: "shopify_payments" });
    });

    it("returns null when no successful SALE/CAPTURE transaction exists", async () => {
      const fetcher = stubFetcher({
        ok: true,
        json: async () => ({
          data: {
            order: {
              id: "gid://shopify/Order/1",
              transactions: [{ id: "gid://shopify/OrderTransaction/1", kind: "AUTHORIZATION", status: "SUCCESS", gateway: "shopify_payments" }]
            }
          }
        })
      });
      const client = makeClient(fetcher);

      const result = await client.getRefundableTransaction("gid://shopify/Order/1");

      expect(result).toBeNull();
    });
  });

  describe("createRefund", () => {
    it("issues a partial refund against the parent transaction with an idempotency key", async () => {
      const fetcher = stubFetcher({
        ok: true,
        json: async () => ({
          data: {
            refundCreate: {
              refund: {
                id: "gid://shopify/Refund/1",
                totalRefundedSet: { presentmentMoney: { amount: "63.00", currencyCode: "USD" } }
              },
              userErrors: []
            }
          }
        })
      });
      const client = makeClient(fetcher);

      const result = await client.createRefund({
        orderGid: "gid://shopify/Order/1",
        amount: 63,
        currencyCode: "USD",
        parentTransactionId: "gid://shopify/OrderTransaction/2",
        gateway: "shopify_payments",
        note: "Cancellation refund",
        idempotencyKey: "cancellation-request-abc123"
      });

      expect(result).toEqual({ refundGid: "gid://shopify/Refund/1", totalRefundedAmount: 63, currencyCode: "USD" });
      const body = JSON.parse(fetcher.mock.calls[1][1].body);
      expect(body.variables.idempotencyKey).toBe("cancellation-request-abc123");
      expect(body.variables.input).toEqual({
        orderId: "gid://shopify/Order/1",
        note: "Cancellation refund",
        transactions: [
          {
            orderId: "gid://shopify/Order/1",
            amount: "63.00",
            gateway: "shopify_payments",
            kind: "REFUND",
            parentId: "gid://shopify/OrderTransaction/2"
          }
        ]
      });
    });

    it("formats the amount without decimals for zero-decimal currencies like JPY", async () => {
      const fetcher = stubFetcher({
        ok: true,
        json: async () => ({
          data: {
            refundCreate: {
              refund: {
                id: "gid://shopify/Refund/1",
                totalRefundedSet: { presentmentMoney: { amount: "12600", currencyCode: "JPY" } }
              },
              userErrors: []
            }
          }
        })
      });
      const client = makeClient(fetcher);

      await client.createRefund({
        orderGid: "gid://shopify/Order/1",
        amount: 12600,
        currencyCode: "JPY",
        parentTransactionId: "gid://shopify/OrderTransaction/2",
        gateway: "shopify_payments",
        idempotencyKey: "key-jpy"
      });

      const body = JSON.parse(fetcher.mock.calls[1][1].body);
      expect(body.variables.input.transactions[0].amount).toBe("12600");
    });

    it("throws with Shopify user errors", async () => {
      const fetcher = stubFetcher({
        ok: true,
        json: async () => ({
          data: {
            refundCreate: {
              refund: null,
              userErrors: [{ field: ["transactions"], message: "Amount exceeds refundable amount" }]
            }
          }
        })
      });
      const client = makeClient(fetcher);

      await expect(
        client.createRefund({
          orderGid: "gid://shopify/Order/1",
          amount: 999,
          currencyCode: "USD",
          parentTransactionId: "gid://shopify/OrderTransaction/2",
          gateway: "shopify_payments",
          idempotencyKey: "key-1"
        })
      ).rejects.toThrow("Amount exceeds refundable amount");
    });

    it("throws when the HTTP response is not ok", async () => {
      const fetcher = stubFetcher({ ok: false, status: 401, json: async () => ({}) });
      const client = makeClient(fetcher);

      await expect(
        client.createRefund({
          orderGid: "gid://shopify/Order/1",
          amount: 10,
          currencyCode: "USD",
          parentTransactionId: "gid://shopify/OrderTransaction/2",
          gateway: "shopify_payments",
          idempotencyKey: "key-1"
        })
      ).rejects.toThrow("Shopify Admin API request failed: 401");
    });
  });

  describe("getRefundedAmountsByLineItem", () => {
    it("sums refunded subtotals per line item across multiple separate refunds", async () => {
      // Regression: an order refunded in two partial installments (e.g. an
      // operator refunds 60% today and the remaining 40% next week) must be
      // recognized as fully refunded once both have happened — reading only
      // a single refunds/create webhook's own payload can't see this.
      const fetcher = stubFetcher({
        ok: true,
        json: async () => ({
          data: {
            order: {
              id: "gid://shopify/Order/1",
              refunds: [
                {
                  refundLineItems: {
                    edges: [{ node: { lineItem: { id: "gid://shopify/LineItem/111" }, subtotalSet: { presentmentMoney: { amount: "150.00" } } } }]
                  }
                },
                {
                  refundLineItems: {
                    edges: [{ node: { lineItem: { id: "gid://shopify/LineItem/111" }, subtotalSet: { presentmentMoney: { amount: "100.00" } } } }]
                  }
                }
              ]
            }
          }
        })
      });
      const client = makeClient(fetcher);

      const amounts = await client.getRefundedAmountsByLineItem("gid://shopify/Order/1", "JPY");

      expect(amounts.get("gid://shopify/LineItem/111")).toBe(250);
    });

    it("returns an empty map when the order has no refunds", async () => {
      const fetcher = stubFetcher({
        ok: true,
        json: async () => ({ data: { order: { id: "gid://shopify/Order/1", refunds: [] } } })
      });
      const client = makeClient(fetcher);

      const amounts = await client.getRefundedAmountsByLineItem("gid://shopify/Order/1", "JPY");

      expect(amounts.size).toBe(0);
    });
  });

  describe("upsertRaffleCustomer", () => {
    function stubUpsertFetcher(steps: { findResponse: unknown; mutationResponse: unknown }) {
      let graphqlCallIndex = 0;
      return vi.fn(async (url: string) => {
        if (String(url).includes("/admin/oauth/access_token")) {
          return TOKEN_RESPONSE;
        }
        graphqlCallIndex += 1;
        return graphqlCallIndex === 1 ? steps.findResponse : steps.mutationResponse;
      });
    }

    it("creates a new customer when no existing customer matches the email", async () => {
      const fetcher = stubUpsertFetcher({
        findResponse: { ok: true, json: async () => ({ data: { customers: { edges: [] } } }) },
        mutationResponse: {
          ok: true,
          json: async () => ({ data: { customerCreate: { customer: { id: "gid://shopify/Customer/1" }, userErrors: [] } } })
        }
      });
      const client = makeClient(fetcher);

      const customerId = await client.upsertRaffleCustomer({
        email: "guest@example.com",
        marketingOptIn: true
      });

      expect(customerId).toBe("gid://shopify/Customer/1");
      const mutationBody = JSON.parse(fetcher.mock.calls[2][1].body);
      expect(mutationBody.query).toContain("customerCreate");
      expect(mutationBody.variables.input.email).toBe("guest@example.com");
      expect(mutationBody.variables.input.emailMarketingConsent.marketingState).toBe("SUBSCRIBED");
    });

    it("updates the existing customer when the email already matches one", async () => {
      const fetcher = stubUpsertFetcher({
        findResponse: {
          ok: true,
          json: async () => ({ data: { customers: { edges: [{ node: { id: "gid://shopify/Customer/9" } }] } } })
        },
        mutationResponse: {
          ok: true,
          json: async () => ({ data: { customerUpdate: { customer: { id: "gid://shopify/Customer/9" }, userErrors: [] } } })
        }
      });
      const client = makeClient(fetcher);

      const customerId = await client.upsertRaffleCustomer({
        email: "returning@example.com",
        gender: "female",
        dateOfBirth: "1990-01-01",
        marketingOptIn: false
      });

      expect(customerId).toBe("gid://shopify/Customer/9");
      const mutationBody = JSON.parse(fetcher.mock.calls[2][1].body);
      expect(mutationBody.query).toContain("customerUpdate");
      expect(mutationBody.variables.input.id).toBe("gid://shopify/Customer/9");
      expect(mutationBody.variables.input.emailMarketingConsent.marketingState).toBe("NOT_SUBSCRIBED");
      expect(mutationBody.variables.input.metafields).toEqual([
        { namespace: "raffle", key: "gender", type: "single_line_text_field", value: "female" },
        { namespace: "raffle", key: "date_of_birth", type: "date", value: "1990-01-01" }
      ]);
    });

    it("throws with Shopify user errors from the mutation", async () => {
      const fetcher = stubUpsertFetcher({
        findResponse: { ok: true, json: async () => ({ data: { customers: { edges: [] } } }) },
        mutationResponse: {
          ok: true,
          json: async () => ({
            data: { customerCreate: { customer: null, userErrors: [{ field: ["email"], message: "Email has already been taken" }] } }
          })
        }
      });
      const client = makeClient(fetcher);

      await expect(client.upsertRaffleCustomer({ email: "dup@example.com", marketingOptIn: false })).rejects.toThrow(
        "Email has already been taken"
      );
    });
  });
});
