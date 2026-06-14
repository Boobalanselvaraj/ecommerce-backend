# E-Commerce API Testing Reference Sheet

Use this cheat sheet to quickly test the endpoints using Postman or any API client.

* **Base URL:** `http://localhost:3000` (or your active PORT)
* **Auth Method:** Cookies are used for auth (`ecommerce_tocken`). If you are testing via Postman, it automatically saves and sends cookies. Alternatively, you can use the Token from login/OTP verify in your header: `Authorization: Bearer <token>` (if supported) or manually configure the cookie in Postman under the **Cookies** tab.

---

## 🔑 Authentication Endpoints

### 1. Register User
* **Method:** `POST`
* **URL:** `/api/auth/register`
* **Body (JSON):**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "mobile": "9876543210",
  "username": "johndoe",
  "password": "password123"
}
```

### 2. Login User
* **Method:** `POST`
* **URL:** `/api/auth/login`
* **Body (JSON):**
```json
{
  "username": "johndoe",
  "password": "password123"
}
```

### 3. Get OTP
* **Method:** `POST`
* **URL:** `/api/auth/getotp`
* **Body (JSON):**
```json
{
  "mobile": "9876543210"
}
```

### 4. Verify OTP
* **Method:** `POST`
* **URL:** `/api/auth/verifyotp`
* **Body (JSON):**
```json
{
  "mobile": "9876543210",
  "otp": "123456"
}
```

### 5. Get Logged In User Info
* **Method:** `GET`
* **URL:** `/api/auth/me`

### 6. Logout User
* **Method:** `POST`
* **URL:** `/api/auth/logout`

---

## 🛒 Cart Endpoints

### 1. Get Cart Items
* **Method:** `GET`
* **URL:** `/api/cart`

### 2. Add Item to Cart
* **Method:** `POST`
* **URL:** `/api/cart`
* **Body (JSON):**
```json
{
  "productId": 1,
  "quantity": 2
}
```

### 3. Update Cart Item Quantity
* **Method:** `PATCH`
* **URL:** `/api/cart/:cartId` (replace `:cartId` with actual Cart ID, e.g., `/api/cart/5`)
* **Body (JSON):**
```json
{
  "quantity": 5
}
```

### 4. Remove Item from Cart
* **Method:** `DELETE`
* **URL:** `/api/cart/:cartId` (e.g., `/api/cart/5`)

### 5. Clear Entire Cart
* **Method:** `DELETE`
* **URL:** `/api/cart`

---

## 📦 Order Endpoints

### 1. Place Order (Checkout Cart)
* **Method:** `POST`
* **URL:** `/api/order`
* **Body:** None (it automatically checkout all items in your cart)

### 2. Get All Orders (User or Admin)
* **Method:** `GET`
* **URL:** `/api/order`
* **Query Params (Optional):**
  * `page`: `1`
  * `limit`: `10`
  * `status`: `PENDING` (or `CONFIRMED`, `SHIPPED`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELED`)
  * `sortBy`: `orderedAt` (or `totalPrice`, `status`)
  * `order`: `desc` (or `asc`)

### 3. Get Single Order Details
* **Method:** `GET`
* **URL:** `/api/order/:id` (replace `:id` with Order ID, e.g., `/api/order/1`)

### 4. Cancel Order
* **Method:** `PATCH`
* **URL:** `/api/order/:id/cancel` (replace `:id` with Order ID, e.g., `/api/order/1/cancel`)

### 5. Update Order Status (Admin Only)
* **Method:** `PATCH`
* **URL:** `/api/order/:id/status` (replace `:id` with Order ID, e.g., `/api/order/1/status`)
* **Body (JSON):**
```json
{
  "status": "CONFIRMED" 
}
```
*(Valid transitions: `CONFIRMED`, `SHIPPED`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELED`)*

### 6. Get Order Stats (Admin Only)
* **Method:** `GET`
* **URL:** `/api/order/stats`

### 7. Delete Order (Admin Only - Cancelled Orders Only)
* **Method:** `DELETE`
* **URL:** `/api/order/:id` (replace `:id` with Order ID, e.g., `/api/order/1`)
