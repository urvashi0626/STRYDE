# STRYDE — Fuel Your Game. Own Your Moment.

A responsive sports shopping website built with **pure HTML5, CSS3 and vanilla JavaScript**: no frameworks, no backend, no database. Customers can browse products, build a cart, enter delivery details and send their order to the store owner through **WhatsApp** or **email**.

## Features

- **Product catalogue**: Premium Cricket Bat, Professional Basketball and Performance Sports Jersey, with quantity controls, Add to Cart, Buy Now and a product details view
- **Shop by sport**: filter by Cricket, Basketball or Sportswear, plus live product search
- **Shopping cart**: add, increase/decrease, remove, line totals, subtotal and total, live header count, empty state; saved in `localStorage`
- **Checkout form**: name, mobile, email, full address, city, state, PIN code and optional notes, with validation for Indian mobile numbers, email format and 6-digit PIN codes
- **Order via WhatsApp**: opens WhatsApp with a pre-filled order message (reference, customer details, items, prices, totals, notes)
- **Order via email**: opens the customer's email app with a pre-filled subject and order body
- **Unique order reference** generated on the device (e.g. `STR-261023-9P6779`)
- **Honest confirmation flow**: the cart is cleared only after the customer confirms they pressed Send, and the confirmation is clearly marked as self-reported
- **Responsive and accessible**: mobile-first layout, hamburger menu, keyboard support, visible focus states, reduced-motion support, image fallbacks

## Tech stack

| Layer   | Technology                         |
|---------|------------------------------------|
| Markup  | HTML5                              |
| Styling | CSS3 (custom properties, grid, flexbox) |
| Logic   | Vanilla JavaScript (ES6+)          |
| Storage | `localStorage` (cart only)         |

## Project structure

stryde/
├── index.html # Page structure, dialogs and checkout form
├── style.css # Styling and responsive layout
└── script.js # Products, cart, validation and ordering logic


## Getting started

1. Clone the repository:
   ```bash
   git clone https://github.com/urvashi0626/STRYDE.git
   ```
   https://github.com/urvashi0626/STRYDE
2. Open `index.html` in your browser. No build step or server is needed.

## Configuration

Open `script.js` and edit the values marked `CONFIG:` at the top:

```js
const OWNER_WHATSAPP = "91XXXXXXXXXX";     // country code + number, digits only
const OWNER_EMAIL = "owner@example.com";   // inbox that receives orders
const PRICES_ARE_SAMPLES = true;           // set to false after entering real prices
const DELIVERY_FEE = 0;                    // flat fee in INR (0 = confirmed by store)
```

- **Product prices:** edit `price` in the `PRODUCTS` array (in INR).
- **Contact details:** fill in `CONTACT_DETAILS`. Empty values are hidden automatically.

## How ordering works

1. The customer adds products to the cart.
2. The customer fills in delivery details at checkout.
3. They choose **Place Order via WhatsApp** or **Place Order via Email**.
4. WhatsApp or their email app opens with the order pre-filled, and **the customer must press Send**.
5. The store owner receives the message and confirms availability, delivery and payment directly.

> **Note:** This is a static site. A `mailto:` or WhatsApp link cannot send messages automatically or guarantee delivery. The site never claims an order was received, takes no payments, and does not store personal details.

## Deployment

Works on any static host: **GitHub Pages**, Netlify or Vercel. For GitHub Pages, go to **Settings → Pages**, choose the `main` branch, and save.


The site is live at https://urvashi0626.github.io/STRYDE/

## License

MIT
