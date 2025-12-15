const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware setup
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'https://inspiring-frangipane-6626b1.netlify.app'
    ],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// MongoDB Connection
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// JWT Middleware
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'Unauthorized access' });
        }
        req.user = decoded;
        next();
    });
};

// Verify Admin
const verifyAdmin = async (req, res, next) => {
    const email = req.user.email;
    const user = await usersCollection.findOne({ email });
    if (user?.role !== 'admin') {
        return res.status(403).send({ message: 'Forbidden access' });
    }
    next();
};

// Verify Manager
const verifyManager = async (req, res, next) => {
    const email = req.user.email;
    const user = await usersCollection.findOne({ email });
    if (user?.role !== 'manager' && user?.role !== 'admin') {
        return res.status(403).send({ message: 'Forbidden access' });
    }
    next();
};

// Verify Buyer
const verifyBuyer = async (req, res, next) => {
    const email = req.user.email;
    const user = await usersCollection.findOne({ email });
    if (user?.role !== 'buyer' && user?.role !== 'admin') {
        return res.status(403).send({ message: 'Forbidden access' });
    }
    next();
};

// Collections
let usersCollection;
let productsCollection;
let ordersCollection;

async function run() {
    try {
        await client.connect();
        console.log('Connected to MongoDB!');

        const database = client.db('garmentsTrackerDB');
        usersCollection = database.collection('users');
        productsCollection = database.collection('products');
        ordersCollection = database.collection('orders');

        // =====================
        // AUTH ROUTES
        // =====================

        // Generate JWT Token
        app.post('/api/auth/jwt', async (req, res) => {
            try {
                const user = req.body;
                const token = jwt.sign(user, process.env.JWT_SECRET, {
                    expiresIn: process.env.JWT_EXPIRE
                });

                res
                    .cookie('token', token, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                        maxAge: parseInt(process.env.COOKIE_EXPIRE) * 24 * 60 * 60 * 1000
                    })
                    .send({ success: true });
            } catch (error) {
                res.status(500).send({ message: 'Error generating token', error: error.message });
            }
        });

        // Logout
        app.post('/api/auth/logout', (req, res) => {
            res
                .clearCookie('token', {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
                })
                .send({ success: true });
        });

        // =====================
        // USER ROUTES
        // =====================

        // Create or Update User
        app.post('/api/users', async (req, res) => {
            try {
                const user = req.body;
                const existingUser = await usersCollection.findOne({ email: user.email });

                if (existingUser) {
                    return res.send({
                        message: 'User already exists',
                        insertedId: existingUser._id
                    });
                }

                const newUser = {
                    ...user,
                    status: user.status || 'pending',
                    createdAt: new Date(),
                    suspendedReason: null
                };

                const result = await usersCollection.insertOne(newUser);
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Error creating user', error: error.message });
            }
        });

        // Get User by Email
        app.get('/api/users/:email', verifyToken, async (req, res) => {
            try {
                const email = req.params.email;
                if (email !== req.user.email) {
                    return res.status(403).send({ message: 'Forbidden access' });
                }
                const user = await usersCollection.findOne({ email });
                res.send(user);
            } catch (error) {
                res.status(500).send({ message: 'Error fetching user', error: error.message });
            }
        });

        // Get All Users (Admin Only)
        app.get('/api/users', verifyToken, verifyAdmin, async (req, res) => {
            try {
                const { search } = req.query;
                let query = {};

                if (search) {
                    query = {
                        $or: [
                            { name: { $regex: search, $options: 'i' } },
                            { email: { $regex: search, $options: 'i' } },
                            { role: { $regex: search, $options: 'i' } }
                        ]
                    };
                }

                const users = await usersCollection.find(query).toArray();
                res.send(users);
            } catch (error) {
                res.status(500).send({ message: 'Error fetching users', error: error.message });
            }
        });

        // Update User Status (Admin Only)
        app.patch('/api/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            try {
                const id = req.params.id;
                const { status, suspendedReason } = req.body;

                const updateDoc = {
                    $set: {
                        status,
                        suspendedReason: status === 'suspended' ? suspendedReason : null,
                        updatedAt: new Date()
                    }
                };

                const result = await usersCollection.updateOne(
                    { _id: new ObjectId(id) },
                    updateDoc
                );
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Error updating user', error: error.message });
            }
        });

        // =====================
        // PRODUCT ROUTES
        // =====================

        // Get All Products (Public)
        app.get('/api/products', async (req, res) => {
            try {
                const { limit, search, category } = req.query;
                let query = {};

                if (search) {
                    query.$or = [
                        { name: { $regex: search, $options: 'i' } },
                        { category: { $regex: search, $options: 'i' } }
                    ];
                }

                if (category) {
                    query.category = category;
                }

                let cursor = productsCollection.find(query);

                if (limit) {
                    cursor = cursor.limit(parseInt(limit));
                }

                const products = await cursor.toArray();
                res.send(products);
            } catch (error) {
                res.status(500).send({ message: 'Error fetching products', error: error.message });
            }
        });

        // Get Products for Home Page (Show on Home = true)
        app.get('/api/products/home', async (req, res) => {
            try {
                const products = await productsCollection
                    .find({ showOnHome: true })
                    .limit(6)
                    .toArray();
                res.send(products);
            } catch (error) {
                res.status(500).send({ message: 'Error fetching home products', error: error.message });
            }
        });

        // Get Single Product
        app.get('/api/products/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const product = await productsCollection.findOne({ _id: new ObjectId(id) });
                res.send(product);
            } catch (error) {
                res.status(500).send({ message: 'Error fetching product', error: error.message });
            }
        });

        // Add Product (Manager/Admin Only)
        app.post('/api/products', verifyToken, verifyManager, async (req, res) => {
            try {
                const product = {
                    ...req.body,
                    createdBy: req.user.email,
                    createdAt: new Date(),
                    showOnHome: req.body.showOnHome || false
                };

                const result = await productsCollection.insertOne(product);
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Error adding product', error: error.message });
            }
        });

        // Update Product
        app.put('/api/products/:id', verifyToken, verifyManager, async (req, res) => {
            try {
                const id = req.params.id;
                const product = req.body;
                delete product._id;

                const updateDoc = {
                    $set: {
                        ...product,
                        updatedAt: new Date()
                    }
                };

                const result = await productsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    updateDoc
                );
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Error updating product', error: error.message });
            }
        });

        // Toggle Show on Home (Admin Only)
        app.patch('/api/products/:id/toggle-home', verifyToken, verifyAdmin, async (req, res) => {
            try {
                const id = req.params.id;
                const product = await productsCollection.findOne({ _id: new ObjectId(id) });

                const updateDoc = {
                    $set: {
                        showOnHome: !product.showOnHome,
                        updatedAt: new Date()
                    }
                };

                const result = await productsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    updateDoc
                );
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Error toggling product', error: error.message });
            }
        });

        // Delete Product
        app.delete('/api/products/:id', verifyToken, verifyManager, async (req, res) => {
            try {
                const id = req.params.id;
                const result = await productsCollection.deleteOne({ _id: new ObjectId(id) });
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Error deleting product', error: error.message });
            }
        });

        // Get Manager's Products
        app.get('/api/manager/products', verifyToken, verifyManager, async (req, res) => {
            try {
                const { search } = req.query;
                let query = { createdBy: req.user.email };

                if (search) {
                    query.$or = [
                        { name: { $regex: search, $options: 'i' } },
                        { category: { $regex: search, $options: 'i' } }
                    ];
                    query.createdBy = req.user.email;
                }

                const products = await productsCollection.find(query).toArray();
                res.send(products);
            } catch (error) {
                res.status(500).send({ message: 'Error fetching manager products', error: error.message });
            }
        });

        // =====================
        // ORDER ROUTES
        // =====================

        // Create Order (Buyer Only)
        app.post('/api/orders', verifyToken, verifyBuyer, async (req, res) => {
            try {
                const order = {
                    ...req.body,
                    buyerEmail: req.user.email,
                    status: 'pending',
                    createdAt: new Date(),
                    tracking: []
                };

                const result = await ordersCollection.insertOne(order);

                // Update product quantity
                await productsCollection.updateOne(
                    { _id: new ObjectId(order.productId) },
                    { $inc: { availableQuantity: -order.quantity } }
                );

                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Error creating order', error: error.message });
            }
        });

        // Get Buyer's Orders
        app.get('/api/buyer/orders', verifyToken, verifyBuyer, async (req, res) => {
            try {
                const orders = await ordersCollection
                    .find({ buyerEmail: req.user.email })
                    .sort({ createdAt: -1 })
                    .toArray();
                res.send(orders);
            } catch (error) {
                res.status(500).send({ message: 'Error fetching buyer orders', error: error.message });
            }
        });

        // Get All Orders (Admin Only)
        app.get('/api/orders', verifyToken, verifyAdmin, async (req, res) => {
            try {
                const { status, search } = req.query;
                let query = {};

                if (status) {
                    query.status = status;
                }

                if (search) {
                    query.$or = [
                        { buyerEmail: { $regex: search, $options: 'i' } },
                        { productName: { $regex: search, $options: 'i' } }
                    ];
                }

                const orders = await ordersCollection.find(query).sort({ createdAt: -1 }).toArray();
                res.send(orders);
            } catch (error) {
                res.status(500).send({ message: 'Error fetching orders', error: error.message });
            }
        });

        // Get Pending Orders (Manager Only)
        app.get('/api/manager/orders/pending', verifyToken, verifyManager, async (req, res) => {
            try {
                const orders = await ordersCollection
                    .find({ status: 'pending' })
                    .sort({ createdAt: -1 })
                    .toArray();
                res.send(orders);
            } catch (error) {
                res.status(500).send({ message: 'Error fetching pending orders', error: error.message });
            }
        });

        // Get Approved Orders (Manager Only)
        app.get('/api/manager/orders/approved', verifyToken, verifyManager, async (req, res) => {
            try {
                const orders = await ordersCollection
                    .find({ status: 'approved' })
                    .sort({ approvedAt: -1 })
                    .toArray();
                res.send(orders);
            } catch (error) {
                res.status(500).send({ message: 'Error fetching approved orders', error: error.message });
            }
        });

        // Get Single Order
        app.get('/api/orders/:id', verifyToken, async (req, res) => {
            try {
                const id = req.params.id;
                const order = await ordersCollection.findOne({ _id: new ObjectId(id) });
                res.send(order);
            } catch (error) {
                res.status(500).send({ message: 'Error fetching order', error: error.message });
            }
        });

        // Update Order Status (Manager Only)
        app.patch('/api/orders/:id/status', verifyToken, verifyManager, async (req, res) => {
            try {
                const id = req.params.id;
                const { status } = req.body;

                const updateDoc = {
                    $set: {
                        status,
                        ...(status === 'approved' && { approvedAt: new Date() }),
                        ...(status === 'rejected' && { rejectedAt: new Date() }),
                        updatedAt: new Date()
                    }
                };

                const result = await ordersCollection.updateOne(
                    { _id: new ObjectId(id) },
                    updateDoc
                );
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Error updating order status', error: error.message });
            }
        });

        // Add Tracking Update (Manager Only)
        app.post('/api/orders/:id/tracking', verifyToken, verifyManager, async (req, res) => {
            try {
                const id = req.params.id;
                const trackingUpdate = {
                    ...req.body,
                    timestamp: new Date()
                };

                const result = await ordersCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $push: { tracking: trackingUpdate },
                        $set: { updatedAt: new Date() }
                    }
                );
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Error adding tracking', error: error.message });
            }
        });

        // Cancel Order (Buyer Only)
        app.patch('/api/orders/:id/cancel', verifyToken, verifyBuyer, async (req, res) => {
            try {
                const id = req.params.id;
                const order = await ordersCollection.findOne({ _id: new ObjectId(id) });

                if (order.status !== 'pending') {
                    return res.status(400).send({ message: 'Cannot cancel approved/rejected order' });
                }

                if (order.buyerEmail !== req.user.email) {
                    return res.status(403).send({ message: 'Forbidden access' });
                }

                const result = await ordersCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            status: 'cancelled',
                            cancelledAt: new Date(),
                            updatedAt: new Date()
                        }
                    }
                );

                // Restore product quantity
                await productsCollection.updateOne(
                    { _id: new ObjectId(order.productId) },
                    { $inc: { availableQuantity: order.quantity } }
                );

                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Error cancelling order', error: error.message });
            }
        });

        // =====================
        // ANALYTICS ROUTES (Admin)
        // =====================

        app.get('/api/analytics', verifyToken, verifyAdmin, async (req, res) => {
            try {
                const { period = '30' } = req.query;
                const days = parseInt(period);
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - days);

                const [
                    totalProducts,
                    totalOrders,
                    totalUsers,
                    activeManagers,
                    recentOrders,
                    productsByCategory
                ] = await Promise.all([
                    productsCollection.countDocuments(),
                    ordersCollection.countDocuments({ createdAt: { $gte: startDate } }),
                    usersCollection.countDocuments(),
                    usersCollection.countDocuments({ role: 'manager', status: 'approved' }),
                    ordersCollection.find({ createdAt: { $gte: startDate } }).toArray(),
                    productsCollection.aggregate([
                        { $group: { _id: '$category', count: { $sum: 1 } } }
                    ]).toArray()
                ]);

                res.send({
                    totalProducts,
                    totalOrders,
                    totalUsers,
                    activeManagers,
                    recentOrders: recentOrders.length,
                    productsByCategory
                });
            } catch (error) {
                res.status(500).send({ message: 'Error fetching analytics', error: error.message });
            }
        });

        // =====================
        // HEALTH CHECK
        // =====================

        app.get('/health', (req, res) => {
            res.send({ status: 'OK', message: 'Server is running' });
        });

        app.get('/', (req, res) => {
            res.send('Garments Order & Production Tracker Server is Running!');
        });

    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }
}

run().catch(console.dir);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
