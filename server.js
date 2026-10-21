
const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Log incoming requests
app.use((req, res, next) => {
    console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`
    );
    next();
});

// Collection configuration
const collections = {
    customers: {
        name: "olist_customers_dataset",
        fields: [
            "customer_id", "customer_unique_id",
            "customer_zip_code_prefix", "customer_city",
            "customer_state"
        ],
        search: ["customer_city", "customer_state"],
        numeric: [],
        dates: []
    },

    geolocation: {
        name: "olist_geolocation_dataset",
        fields: [
            "geolocation_zip_code_prefix", "geolocation_lat",
            "geolocation_lng", "geolocation_city",
            "geolocation_state"
        ],
        search: ["geolocation_city", "geolocation_state"],
        numeric: ["geolocation_lat", "geolocation_lng"],
        dates: []
    },

    orderItems: {
        name: "olist_order_items_dataset",
        fields: [
            "order_id", "order_item_id", "product_id",
            "seller_id", "shipping_limit_date",
            "price", "freight_value"
        ],
        search: ["order_id", "product_id", "seller_id"],
        numeric: ["order_item_id", "price", "freight_value"],
        dates: ["shipping_limit_date"]
    },

    payments: {
        name: "olist_order_payments_dataset",
        fields: [
            "order_id", "payment_sequential", "payment_type",
            "payment_installments", "payment_value"
        ],
        search: ["order_id", "payment_type"],
        numeric: [
            "payment_sequential", "payment_installments",
            "payment_value"
        ],
        dates: []
    },

    reviews: {
        name: "olist_order_reviews_dataset",
        fields: [
            "review_id", "order_id", "review_score",
            "review_comment_title", "review_comment_message",
            "review_creation_date", "review_answer_timestamp"
        ],
        search: [
            "review_id", "order_id",
            "review_comment_title", "review_comment_message"
        ],
        numeric: ["review_score"],
        dates: ["review_creation_date", "review_answer_timestamp"]
    },

    orders: {
        name: "olist_orders_dataset",
        fields: [
            "order_id", "customer_id", "order_status",
            "order_purchase_timestamp", "order_approved_at",
            "order_delivered_carrier_date",
            "order_delivered_customer_date",
            "order_estimated_delivery_date"
        ],
        search: ["order_id", "customer_id", "order_status"],
        numeric: [],
        dates: [
            "order_purchase_timestamp", "order_approved_at",
            "order_delivered_carrier_date",
            "order_delivered_customer_date",
            "order_estimated_delivery_date"
        ]
    },

    products: {
        name: "olist_products_dataset",
        fields: [
            "product_id", "product_category_name",
            "product_name_lenght", "product_description_lenght",
            "product_photos_qty", "product_weight_g",
            "product_length_cm", "product_height_cm",
            "product_width_cm"
        ],
        search: ["product_id", "product_category_name"],
        numeric: [
            "product_name_lenght", "product_description_lenght",
            "product_photos_qty", "product_weight_g",
            "product_length_cm", "product_height_cm",
            "product_width_cm"
        ],
        dates: []
    },

    sellers: {
        name: "olist_sellers_dataset",
        fields: [
            "seller_id", "seller_zip_code_prefix",
            "seller_city", "seller_state"
        ],
        search: ["seller_id", "seller_city", "seller_state"],
        numeric: [],
        dates: []
    },

    categories: {
        name: "product_category_name_translation",
        fields: [
            "product_category_name",
            "product_category_name_english"
        ],
        search: [
            "product_category_name",
            "product_category_name_english"
        ],
        numeric: [],
        dates: []
    }
};

// Get MongoDB collection
function getCollection(key) {
    return mongoose.connection.db.collection(
        collections[key].name
    );
}

// Validate pagination integers
function parseInteger(value, fallback, min, max) {
    if (value === undefined) return fallback;

    const parsed = Number(value);

    if (
        !Number.isInteger(parsed) ||
        parsed < min ||
        parsed > max
    ) {
        throw new Error(
            `Expected an integer between ${min} and ${max}`
        );
    }

    return parsed;
}

// Escape regular expression characters in search input
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Validate and construct MongoDB queries
function buildQuery(config, params) {
    const query = {};

    // Exact match: ?field=customer_state&value=SP
    if (params.value !== undefined) {
        const field = params.field;

        if (!field || !config.fields.includes(field)) {
            throw new Error("Provide a valid field and value");
        }

        query[field] = params.value;
    }

    // Search configured fields: ?q=sao%20paulo
    if (params.q !== undefined) {
        const term = String(params.q).trim();

        if (!term || term.length > 100) {
            throw new Error(
                "Search term must contain 1-100 characters"
            );
        }

        query.$or = config.search.map((field) => ({
            [field]: {
                $regex: escapeRegex(term),
                $options: "i"
            }
        }));
    }

    // Numeric range: ?field=price&min=50&max=100
    if (
        params.min !== undefined ||
        params.max !== undefined
    ) {
        const field = params.field;

        if (!field || !config.numeric.includes(field)) {
            throw new Error(
                "Numeric range requires a supported numeric field"
            );
        }

        const conditions = [];

        for (const bound of ["min", "max"]) {
            if (params[bound] === undefined) continue;

            const number = Number(params[bound]);

            if (!Number.isFinite(number)) {
                throw new Error(`${bound} must be a number`);
            }

            const operator = bound === "min" ? "$gte" : "$lte";

            conditions.push({
                [operator]: [
                    {
                        $convert: {
                            input: `$${field}`,
                            to: "double",
                            onError: null,
                            onNull: null
                        }
                    },
                    number
                ]
            });
        }

        query.$expr = { $and: conditions };
    }

    // Lexicographic date range for ISO-formatted strings
    if (
        params.start !== undefined ||
        params.end !== undefined
    ) {
        const field = params.field;

        if (!field || !config.dates.includes(field)) {
            throw new Error(
                "Date range requires a supported date field"
            );
        }

        query[field] = {};

        if (params.start !== undefined) {
            query[field].$gte = params.start;
        }

        if (params.end !== undefined) {
            query[field].$lte = params.end;
        }
    }

    return query;
}

// API home
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Olist E-commerce API is running",
        collections: Object.fromEntries(
            Object.entries(collections).map(([key, config]) => [
                key,
                `/api/${key}`
            ])
        )
    });
});

// Generate list, count, and stats endpoints for each collection
for (const [key, config] of Object.entries(collections)) {

    // GET /api/:key
    app.get(`/api/${key}`, async (req, res, next) => {
        try {
            const limit = parseInteger(
                req.query.limit, 50, 1, 500
            );

            const skip = parseInteger(
                req.query.skip, 0, 0, 10000000
            );

            const sortBy = req.query.sortBy || "_id";
            const order = req.query.order || "asc";

            if (
                (sortBy !== "_id" &&
                    !config.fields.includes(sortBy)) ||
                !["asc", "desc"].includes(order)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid sortBy field or order"
                });
            }

            const query = buildQuery(config, req.query);
            const collection = getCollection(key);

            const [data, total] = await Promise.all([
                collection.find(query)
                    .sort({
                        [sortBy]: order === "asc" ? 1 : -1
                    })
                    .skip(skip)
                    .limit(limit)
                    .toArray(),

                collection.countDocuments(query)
            ]);

            res.json({
                success: true,
                collection: config.name,
                pagination: {
                    total,
                    limit,
                    skip,
                    returned: data.length,
                    hasMore: skip + data.length < total
                },
                data
            });
        } catch (error) {
            next(error);
        }
    });

    // GET /api/:key/count
    app.get(`/api/${key}/count`, async (req, res, next) => {
        try {
            const query = buildQuery(config, req.query);
            const count = await getCollection(key)
                .countDocuments(query);

            res.json({
                success: true,
                collection: config.name,
                count
            });
        } catch (error) {
            next(error);
        }
    });

    // GET /api/:key/stats
    app.get(`/api/${key}/stats`, async (req, res, next) => {
        try {
            const collection = getCollection(key);
            const query = buildQuery(config, req.query);

            const [count, sample] = await Promise.all([
                collection.countDocuments(query),
                collection.find(query).limit(1).toArray()
            ]);

            res.json({
                success: true,
                collection: config.name,
                count,
                availableFields: config.fields,
                sampleDocument: sample[0] || null
            });
        } catch (error) {
            next(error);
        }
    });
}

// Order details with associated items, payments, and reviews
app.get("/api/orders/:orderId/details", async (req, res, next) => {
    try {
        const { orderId } = req.params;

        const [order, items, payments, reviews] =
            await Promise.all([
                getCollection("orders").findOne({
                    order_id: orderId
                }),
                getCollection("orderItems")
                    .find({ order_id: orderId }).toArray(),
                getCollection("payments")
                    .find({ order_id: orderId }).toArray(),
                getCollection("reviews")
                    .find({ order_id: orderId }).toArray()
            ]);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        res.json({
            success: true,
            data: { order, items, payments, reviews }
        });
    } catch (error) {
        next(error);
    }
});

// Handle unknown endpoints
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Endpoint not found"
    });
});

// Central error handler
app.use((error, req, res, next) => {
    console.error("API error:", error.message);

    if (res.headersSent) {
        return next(error);
    }

    res.status(400).json({
        success: false,
        message: error.message || "Internal server error"
    });
});

// Connect to MongoDB before starting server
async function startServer() {
    if (!process.env.MONGODB_URL) {
        throw new Error("MONGODB_URL is missing from .env");
    }

    console.log("Starting Olist API...");
    console.log(
        `Environment: ${process.env.NODE_ENV || "development"}`
    );

    await mongoose.connect(process.env.MONGODB_URL);

    console.log("MongoDB connected successfully");
    console.log(`Database: ${mongoose.connection.name}`);

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`API server running on port ${PORT}`);
        console.log(`Local URL: http://localhost:${PORT}`);
    });
}

startServer().catch((error) => {
    console.error("Application startup failed:", error.message);
    process.exit(1);
});
