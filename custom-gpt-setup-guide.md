# Custom GPT Setup Guide
## Staffordshire Wood Fuels & Staffordshire Cleaning Supplies

---

## What you're building

A Custom GPT at chat.openai.com/gpts that customers can talk to:
- "What logs do you sell?"
- "Do you have charcoal in stock?"
- "What's the cheapest cleaning chemical you have?"
- "Tell me about your trade accounts"

The GPT pulls **live product data** from your store via the API we just built.

---

## Step 1 — Create the Custom GPT

1. Go to [chat.openai.com/gpts/editor](https://chat.openai.com/gpts/editor)
2. Click **Create**
3. You'll land in the GPT editor

---

## Step 2 — Configure the GPT

**For Staffordshire Wood Fuels:**

> **Name:** Staffordshire Wood Fuels Assistant
>
> **Description:** Ask about our kiln-dried logs, charcoal, kindling and firewood — check availability, prices, and get advice on what to order.
>
> **Instructions:**
> ```
> You are the helpful sales assistant for Staffordshire Wood Fuels (staffordshirewoodfuels.co.uk), a premium kiln-dried firewood and charcoal supplier based in Longton, Staffordshire, UK.
>
> When answering questions about products, availability or prices, ALWAYS call the searchProducts action first to get live data. Never make up prices or stock levels.
>
> Key facts:
> - Free delivery on every order to mainland UK
> - Prices shown are inc. VAT
> - Orders before 3pm dispatched same day (Mon–Fri) via ParcelForce Next Day
> - Sustainably sourced, Woodsure certified
> - 126 five-star reviews
> - Contact: info@staffordshirewoodfuels.co.uk
>
> Always end product recommendations with the direct URL to the product page so the customer can order.
> Keep answers concise and practical. Tone: friendly, knowledgeable, British.
> ```
>
> **Profile photo:** upload your SWF logo

---

**For Staffordshire Cleaning Supplies:**

> **Name:** SCS Product Assistant
>
> **Description:** Ask about our professional cleaning chemicals, janitorial supplies, and equipment — prices, availability, COSHH docs, and trade accounts.
>
> **Instructions:**
> ```
> You are the helpful trade sales assistant for Staffordshire Cleaning Supplies (staffordshirecleaningsupplies.co.uk), a professional cleaning products supplier based in Longton, Staffordshire, UK.
>
> When answering questions about products, availability or prices, ALWAYS call the searchProducts action first to get live data. Never make up prices or stock levels.
>
> Key facts:
> - Prices shown are ex. VAT (add 20% for the VAT-inclusive total)
> - Free delivery on orders over £50 ex. VAT; otherwise £5.99 DPD Next Day
> - Orders before 3pm dispatched same day (Mon–Fri)
> - COSHH / Safety Data Sheets available on request for all chemical products
> - Trade accounts available with monthly invoicing
> - No minimum order
> - Contact: info@staffordshirecleaningsupplies.co.uk
>
> Always end product recommendations with the direct URL to the product page.
> Keep answers concise and practical. Tone: professional, trade-focused, British.
> ```
>
> **Profile photo:** upload your SCS logo

---

## Step 3 — Add the Action (live product search)

In the GPT editor, click **Configure** → **Add action**

Paste this OpenAPI schema:

**For SWF** (use `staffordshirewoodfuels.co.uk`):

```yaml
openapi: 3.1.0
info:
  title: SWF Product Search
  version: 1.0.0
servers:
  - url: https://staffordshirewoodfuels.co.uk
paths:
  /api/gpt/products:
    get:
      operationId: searchProducts
      summary: Search or list products from the store
      parameters:
        - name: q
          in: query
          description: Search term (product name, type, or description)
          schema:
            type: string
        - name: type
          in: query
          description: Filter by product category (e.g. "Kiln Dried Wood", "Charcoal")
          schema:
            type: string
        - name: limit
          in: query
          description: Number of results to return (max 20)
          schema:
            type: integer
            default: 10
        - name: inStock
          in: query
          description: Set to true to return only in-stock products
          schema:
            type: boolean
      responses:
        "200":
          description: Product list
          content:
            application/json:
              schema:
                type: object
                properties:
                  products:
                    type: array
                    items:
                      type: object
```

**For SCS**: identical but change the server URL to `https://staffordshirecleaningsupplies.co.uk`

---

## Step 4 — Publish

- Set visibility to **Anyone with a link** (or **Public** if you want it discoverable)
- Click **Save**
- Copy the GPT link to share with customers, embed on your site, or add to email signatures

---

## Step 5 — Facebook & WhatsApp setup

### Facebook Shops

1. Go to [business.facebook.com/commerce](https://business.facebook.com/commerce)
2. Create a **Catalog** (type: E-commerce)
3. Choose **Data Feed** → **Scheduled Feed**
4. Enter your feed URL:
   - SWF: `https://staffordshirewoodfuels.co.uk/api/feeds/products.xml`
   - SCS: `https://staffordshirecleaningsupplies.co.uk/api/feeds/products.xml`
5. Set schedule: **Daily**
6. Once imported, go to **Shops** → connect your Facebook Page and enable the shop

### WhatsApp Business Catalog

1. WhatsApp Business catalog uses the **same Commerce Manager catalog** as Facebook
2. In Commerce Manager → **Channels** → enable **WhatsApp**
3. Open WhatsApp Business app → Catalog → it will sync automatically

### Google Merchant Center (for ChatGPT Shopping)

1. Go to [merchants.google.com](https://merchants.google.com)
2. Add your store and verify domain ownership
3. Go to **Products** → **Feeds** → **Add feed**
4. Choose **Scheduled fetch** and enter your feed URL
5. Once approved, products appear in Google Shopping — which ChatGPT now indexes for its shopping features

---

## Feed URL summary

| Store | Feed URL |
|-------|----------|
| SWF | `https://staffordshirewoodfuels.co.uk/api/feeds/products.xml` |
| SCS | `https://staffordshirecleaningsupplies.co.uk/api/feeds/products.xml` |

Both update automatically as products are added/changed in your admin.

---

## Judge.me — current status

The Judge.me account is tied to the old Shopify store, so the API token doesn't work on the new site. Two options:

1. **Contact Judge.me support** — ask them to migrate your reviews to the new domain (`staffordshirewoodfuels.co.uk`). They do this for platform migrations.
2. **New account** — create a new Judge.me account, import reviews from a CSV export, and add the new API token to Vercel as `JUDGE_ME_API_TOKEN`.

Once you have a working token, the code is already wired up to use it — just needs the env var set.
