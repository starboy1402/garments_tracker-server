# Garments Order & Production Tracker - Backend Server

## Project Overview
Backend server for a comprehensive Garments Order & Production Tracker System. This system manages garment factory production workflows, orders, inventory, and user roles.

## Live URL
[(https://inspiring-frangipane-6626b1.netlify.app/)]

## Features
- **JWT Authentication** with HTTP-only cookies
- **Role-based Authorization** (Admin, Manager, Buyer)
- **User Management** with approval/suspension system
- **Product Management** with CRUD operations
- **Order Tracking System** with real-time updates
- **Analytics Dashboard** for admin insights
- **Search & Filter** functionality across resources
- **Secure API** with middleware protection

## Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB
- **Authentication**: JWT (JSON Web Tokens)
- **Payment**: Stripe Integration (optional)

## NPM Packages Used
- `express` - Web framework
- `cors` - Cross-origin resource sharing
- `dotenv` - Environment variable management
- `mongodb` - MongoDB driver
- `jsonwebtoken` - JWT token generation and verification
- `cookie-parser` - Parse HTTP cookies
- `bcryptjs` - Password hashing
- `stripe` - Payment processing
- `nodemon` - Development auto-reload

## Environment Variables
Create a `.env` file in the root directory:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=7d
COOKIE_EXPIRE=7
NODE_ENV=development
CLIENT_URL=http://localhost:5173
STRIPE_SECRET_KEY=your_stripe_secret_key
```

## Installation & Setup

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Create `.env` file with your credentials

4. Run the development server:
```bash
npm run dev
```

5. For production:
```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/jwt` - Generate JWT token
- `POST /api/auth/logout` - Clear auth cookie

### Users
- `GET /api/users` - Get all users (Admin)
- `GET /api/users/:email` - Get user by email
- `POST /api/users` - Create new user
- `PATCH /api/users/:id` - Update user status (Admin)

### Products
- `GET /api/products` - Get all products
- `GET /api/products/home` - Get home page products
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Add product (Manager/Admin)
- `PUT /api/products/:id` - Update product (Manager/Admin)
- `DELETE /api/products/:id` - Delete product (Manager/Admin)
- `PATCH /api/products/:id/toggle-home` - Toggle show on home (Admin)
- `GET /api/manager/products` - Get manager's products

### Orders
- `GET /api/orders` - Get all orders (Admin)
- `GET /api/orders/:id` - Get single order
- `POST /api/orders` - Create order (Buyer)
- `GET /api/buyer/orders` - Get buyer's orders
- `GET /api/manager/orders/pending` - Get pending orders (Manager)
- `GET /api/manager/orders/approved` - Get approved orders (Manager)
- `PATCH /api/orders/:id/status` - Update order status (Manager)
- `POST /api/orders/:id/tracking` - Add tracking update (Manager)
- `PATCH /api/orders/:id/cancel` - Cancel order (Buyer)

### Analytics
- `GET /api/analytics` - Get analytics data (Admin)

## Database Collections

### Users Collection
```javascript
{
  name: String,
  email: String,
  photoURL: String,
  role: String, // 'admin', 'manager', 'buyer'
  status: String, // 'pending', 'approved', 'suspended'
  suspendedReason: String,
  createdAt: Date
}
```

### Products Collection
```javascript
{
  name: String,
  description: String,
  category: String,
  price: Number,
  availableQuantity: Number,
  minimumOrderQuantity: Number,
  images: [String],
  demoVideo: String,
  paymentOptions: String, // 'cash' or 'payfirst'
  showOnHome: Boolean,
  createdBy: String,
  createdAt: Date
}
```

### Orders Collection
```javascript
{
  productId: String,
  productName: String,
  buyerEmail: String,
  firstName: String,
  lastName: String,
  quantity: Number,
  orderPrice: Number,
  contactNumber: String,
  deliveryAddress: String,
  additionalNotes: String,
  paymentMethod: String,
  status: String, // 'pending', 'approved', 'rejected', 'cancelled'
  tracking: [{
    location: String,
    note: String,
    status: String,
    timestamp: Date
  }],
  createdAt: Date,
  approvedAt: Date
}
```

## Middleware

### verifyToken
Validates JWT token from cookies and attaches user to request.

### verifyAdmin
Ensures the authenticated user has admin role.

### verifyManager
Ensures the authenticated user has manager or admin role.

### verifyBuyer
Ensures the authenticated user has buyer or admin role.

## Security Features
- HTTP-only cookies for JWT storage
- Role-based access control
- Secure cookie configuration for production
- MongoDB injection prevention
- CORS protection

## Deployment
Ready for deployment on:
- Vercel
- Railway
- Render
- Heroku

## Author
[Your Name]

## License
ISC
