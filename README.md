# Hank's BBQ, UI folder

Static front end. Open `index.html` through the backend (it should serve this folder) or with Live Server on port 5500.
`js/api.js` has `API_PORT` (default 8000). Change it to the backend port. Same origin deployments need no change.

Files
- index.html and admin.html: pages
- css/shop.css (shop), css/styles.css (admin), css/transition.css (page curtain)
- js/api.js shared helpers and CONFIG, js/app.js shop, js/admin.js admin, js/fx.js motion, js/options.js item choices, js/transition.js
- img/logo.png (transparent logo), img/favicon.png
- Optional: img/hero-burger.png (cut out photo), img/hero.jpg or img/hero.mp4 replace the logo emblem in the hero

Endpoints the UI calls
- POST /signup with { "full_name", "phone_number", "password" }
- POST /login with { "phone_number", "password" }, returns { "access_token" }
- GET /me returns id, full_name, phone_number, role
- GET /categories, GET /products
- GET /cart, POST /cart/items, DELETE /cart/items/{product_id}?quantity=1, DELETE /cart
- POST /cart/checkout with JSON { "delivery_address": string, "notes": string }
- GET /orders, POST /orders/{id}/cancel
- Orders returned to the admin should include full_name and phone_number of the customer.
- Admin: GET /admin/orders?limit=200, PATCH /admin/orders/{id}/status, /admin/categories, /admin/products, /admin/users, POST /admin/uploads/product-image
- reset.html is not linked anywhere now (password reset was removed). It can be deleted.

Privacy Policy and Terms of Service
- privacy.html and terms.html are linked in the footer and under the sign up button.
- The privacy page says passwords are stored in a protected form. The backend must hash passwords (bcrypt or argon2), never store them in plain text.
- The pages are written as a solid starting point. Have the owner (or a lawyer) read them once and change anything that does not match how the restaurant works, for example payment methods or the delivery area.

About section photos: img/about-wall.jpg and img/about-sign.jpg. Replace the files to change the photos.

Order notes (new checkout step)
- Checkout has 3 steps: delivery or pickup, notes, review.
- The notes go in the `notes` field of POST /cart/checkout (max 500 characters).
- Item choices come first, then the customer's own text after the marker `Notes: `. Example:
  `Brisket Plate: Sauce on the side. Notes: No pickles, extra napkins`
- The orders list endpoints (GET /orders and GET /admin/orders) must return `notes` on each order.
  The admin board splits it into a "Customer note" box and an "Item choices" box.
- Empty `delivery_address` means pickup.
