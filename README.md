# SalesApi --- Olist E-commerce REST API

A REST API built with **Node.js**, **Express.js**, and **MongoDB** for
querying the Olist e-commerce dataset. It provides reusable endpoints
for pagination, filtering, searching, sorting, counts, collection
statistics, and retrieving an order with its related records.

## Table of Contents

-   [Features](#features)
-   [Tech Stack](#tech-stack)
-   [Prerequisites](#prerequisites)
-   [Project Setup](#project-setup)
-   [Environment Variables](#environment-variables)
-   [Run the API](#run-the-api)
-   [API Reference](#api-reference)
    -   [Health Check](#health-check)
    -   [Collection Endpoints](#collection-endpoints)
    -   [Pagination and Sorting](#pagination-and-sorting)
    -   [Filtering and Search](#filtering-and-search)
    -   [Numeric Ranges](#numeric-ranges)
    -   [Date Ranges](#date-ranges)
    -   [Counts and Statistics](#counts-and-statistics)
    -   [Order Details](#order-details)
-   [Response Format](#response-format)
-   [Supported Fields](#supported-fields)
-   [MongoDB Data Notes](#mongodb-data-notes)
-   [Deploying to Render](#deploying-to-render)
-   [Security and Production Notes](#security-and-production-notes)
-   [Troubleshooting](#troubleshooting)

## Features

-   Query all eight configured MongoDB collections.
-   Paginate results with `limit` and `skip`.
-   Sort results by supported fields in ascending or descending order.
-   Filter by exact field values.
-   Search configured text fields case-insensitively.
-   Filter numeric-string fields using minimum and maximum values.
-   Filter consistently formatted date strings by start and end.
-   Retrieve document counts and collection metadata.
-   Retrieve an order with its items, payments, and reviews.
-   Return JSON responses and log incoming requests.

## Tech Stack

-   **Node.js** --- JavaScript runtime
-   **Express.js** --- HTTP server and routing
-   **Mongoose** --- MongoDB connection
-   **MongoDB Atlas** --- cloud database (or a compatible MongoDB
    deployment)
-   **dotenv** --- loads environment variables from `.env`

## Prerequisites

-   Node.js (LTS recommended) and npm
-   A MongoDB database and connection string
-   The Olist collections imported into that database

## Project Setup

Open PowerShell in the project directory and install dependencies:

``` powershell
npm init -y
npm install express mongoose dotenv
```

If the CSV ingestion script is also part of this project, install its
parser dependency:

``` powershell
npm install csv-parser
```

A typical project layout:

``` text
SalesApi/
├── server.js
├── ingest.js                 # optional CSV ingestion script
├── package.json
├── package-lock.json
├── .env                      # local secrets; do not commit
├── .gitignore
└── data/                     # optional source CSV files
```

Add the following to `.gitignore`:

``` gitignore
node_modules/
.env
```

## Environment Variables

Create a `.env` file in the project root:

``` env
MONGODB_URL=mongodb+srv://<username>:<password>@<cluster-host>/<database-name>?retryWrites=true&w=majority
PORT=3000
NODE_ENV=development
```

Replace the placeholders with your actual MongoDB connection details.
Use a **MongoDB database user** created in Atlas, not necessarily your
Atlas website login. URL-encode special characters in the username or
password as needed.

In MongoDB Atlas, ensure the database user has the required permissions
and your current IP address is allowed under Network Access. For Render,
configure `MONGODB_URL` and any other environment variables in the
service's Environment settings instead of uploading `.env`.

## Run the API

Start the server:

``` powershell
node server.js
```

The server connects to MongoDB before listening for requests. On
successful startup, logs should confirm the database connection and the
port.

Open the health endpoint:

``` text
http://localhost:3000/
```

The API uses `process.env.PORT` when available and defaults to port
`3000`.

## API Reference

All endpoints below assume the local base URL:

``` text
http://localhost:3000
```

When deployed, replace it with your Render service URL.

### Health Check

  -----------------------------------------------------------------------
  Method                  Endpoint                Description
  ----------------------- ----------------------- -----------------------
  `GET`                   `/`                     Confirms the API is
                                                  running and lists
                                                  collection endpoint
                                                  aliases.

  -----------------------------------------------------------------------

### Collection Endpoints

Each collection alias has three standard endpoints:

  ---------------------------------------------------------------------------
  Method                  Endpoint pattern            Description
  ----------------------- --------------------------- -----------------------
  `GET`                   `/api/{collection}`         Retrieve documents with
                                                      optional pagination,
                                                      sorting, filtering, and
                                                      search.

  `GET`                   `/api/{collection}/count`   Count documents
                                                      matching the optional
                                                      filters.

  `GET`                   `/api/{collection}/stats`   Return a document
                                                      count, available
                                                      fields, and one sample
                                                      document.
  ---------------------------------------------------------------------------

Available aliases and their underlying MongoDB collections:

  Alias           MongoDB collection
  --------------- -------------------------------------
  `customers`     `olist_customers_dataset`
  `geolocation`   `olist_geolocation_dataset`
  `orderItems`    `olist_order_items_dataset`
  `payments`      `olist_order_payments_dataset`
  `reviews`       `olist_order_reviews_dataset`
  `orders`        `olist_orders_dataset`
  `products`      `olist_products_dataset`
  `sellers`       `olist_sellers_dataset`
  `categories`    `product_category_name_translation`

Example requests:

``` text
GET /api/customers
GET /api/orders?limit=20
GET /api/products/count
GET /api/orders/stats
```

### Pagination and Sorting

  -----------------------------------------------------------------------
  Parameter               Meaning                 Default / constraints
  ----------------------- ----------------------- -----------------------
  `limit`                 Maximum documents       Default `50`; range
                          returned                `1`--`500`

  `skip`                  Number of documents to  Default `0`; maximum
                          skip                    `10000000`

  `sortBy`                Field to sort by        Default `_id`; must be
                                                  an allowed field or
                                                  `_id`

  `order`                 Sort direction          `asc` or `desc`;
                                                  default `asc`
  -----------------------------------------------------------------------

Examples:

``` text
GET /api/customers?limit=10
GET /api/customers?limit=10&skip=10
GET /api/orderItems?sortBy=price&order=desc&limit=20
```

The list response includes pagination metadata: `total`, `limit`,
`skip`, `returned`, and `hasMore`.

### Filtering and Search

**Exact field match**

Use `field` and `value`. The field must be supported by that collection.

``` text
GET /api/orders?field=order_status&value=delivered
GET /api/customers?field=customer_state&value=SP
GET /api/payments?field=payment_type&value=credit_card
```

**Text search**

Use `q` to search the collection's configured searchable fields. Search
is case-insensitive and treats regex-special characters literally.

``` text
GET /api/customers?q=sao%20paulo
GET /api/products?q=perfumaria
GET /api/reviews?q=excellent
```

Searchable fields differ by collection. See [Supported
Fields](#supported-fields).

### Numeric Ranges

Use `field`, `min`, and/or `max` for fields configured as numeric:

``` text
GET /api/orderItems?field=price&min=50&max=100
GET /api/payments?field=payment_value&min=100
GET /api/reviews?field=review_score&min=4&max=5
GET /api/products?field=product_weight_g&max=500
```

The source CSV values are strings. The API uses MongoDB `$convert` to
convert configured numeric fields to numbers during range comparisons.
Values that cannot be converted do not match the numeric range.

### Date Ranges

Use `field`, `start`, and/or `end` on configured date fields:

``` text
GET /api/orders?field=order_purchase_timestamp&start=2017-10-01&end=2017-10-31
GET /api/reviews?field=review_creation_date&start=2018-01-01&end=2018-01-31
```

**Important:** these are string comparisons, not MongoDB date
comparisons. They work when values use a consistent, sortable format
such as `YYYY-MM-DD HH:mm:ss`. Since the end date above is interpreted
as the literal string `2017-10-31`, it may exclude timestamps later that
same day. To include a full day, supply an end timestamp such as
`2017-10-31 23:59:59`. For production use, consider storing dates as
BSON Date values and querying actual date ranges.

### Counts and Statistics

Count all documents in a collection:

``` text
GET /api/products/count
```

Count matching documents:

``` text
GET /api/reviews/count?field=review_score&value=5
GET /api/orders/count?field=order_status&value=delivered
```

Inspect a collection's fields and one sample document:

``` text
GET /api/orders/stats
GET /api/customers/stats
```

The `stats` endpoint currently provides metadata and a sample document;
it does not calculate sales totals, averages, or grouped analytics.

### Order Details

Retrieve an order and its related items, payments, and reviews using its
`order_id`:

``` text
GET /api/orders/e481f51cbdc54678b7cc49136f2d6af7/details
```

The response includes:

-   `order` --- matching order document
-   `items` --- associated order-item documents
-   `payments` --- associated payment documents
-   `reviews` --- associated review documents

Returns `404` if the order does not exist.

## Response Format

Successful list requests return a JSON object similar to:

``` json
{
  "success": true,
  "collection": "olist_customers_dataset",
  "pagination": {
    "total": 99441,
    "limit": 10,
    "skip": 0,
    "returned": 10,
    "hasMore": true
  },
  "data": [
    {
      "_id": "MongoDB-generated ObjectId",
      "customer_id": "example-customer-id",
      "customer_unique_id": "example-unique-id",
      "customer_zip_code_prefix": "14409",
      "customer_city": "franca",
      "customer_state": "SP"
    }
  ]
}
```

The values above illustrate the response shape; actual records depend on
your database.

A count response looks like:

``` json
{
  "success": true,
  "collection": "olist_products_dataset",
  "count": 32951
}
```

Errors use a JSON response with `success: false` and a `message`.
Invalid query parameters generally return HTTP `400`; unknown endpoints
return `404`.

## Supported Fields

The fields below can be used for exact matching and sorting. Numeric
fields can also be used with `min`/`max`, and date fields with
`start`/`end`.

  ----------------------------------------------------------------------------------------------------------------
  Alias             Exact-match / sort fields          Numeric range fields            Date range fields
  ----------------- ---------------------------------- ------------------------------- ---------------------------
  `customers`       `customer_id`,                     None                            None
                    `customer_unique_id`,                                              
                    `customer_zip_code_prefix`,                                        
                    `customer_city`, `customer_state`                                  

  `geolocation`     `geolocation_zip_code_prefix`,     `geolocation_lat`,              None
                    `geolocation_lat`,                 `geolocation_lng`               
                    `geolocation_lng`,                                                 
                    `geolocation_city`,                                                
                    `geolocation_state`                                                

  `orderItems`      `order_id`, `order_item_id`,       `order_item_id`, `price`,       `shipping_limit_date`
                    `product_id`, `seller_id`,         `freight_value`                 
                    `shipping_limit_date`, `price`,                                    
                    `freight_value`                                                    

  `payments`        `order_id`, `payment_sequential`,  `payment_sequential`,           None
                    `payment_type`,                    `payment_installments`,         
                    `payment_installments`,            `payment_value`                 
                    `payment_value`                                                    

  `reviews`         `review_id`, `order_id`,           `review_score`                  `review_creation_date`,
                    `review_score`,                                                    `review_answer_timestamp`
                    `review_comment_title`,                                            
                    `review_comment_message`,                                          
                    `review_creation_date`,                                            
                    `review_answer_timestamp`                                          

  `orders`          `order_id`, `customer_id`,         None                            All configured order
                    `order_status`,                                                    timestamps
                    `order_purchase_timestamp`,                                        
                    `order_approved_at`,                                               
                    `order_delivered_carrier_date`,                                    
                    `order_delivered_customer_date`,                                   
                    `order_estimated_delivery_date`                                    

  `products`        `product_id`,                      `product_name_lenght`,          None
                    `product_category_name`,           `product_description_lenght`,   
                    `product_name_lenght`,             `product_photos_qty`,           
                    `product_description_lenght`,      `product_weight_g`,             
                    `product_photos_qty`,              `product_length_cm`,            
                    `product_weight_g`,                `product_height_cm`,            
                    `product_length_cm`,               `product_width_cm`              
                    `product_height_cm`,                                               
                    `product_width_cm`                                                 

  `sellers`         `seller_id`,                       None                            None
                    `seller_zip_code_prefix`,                                          
                    `seller_city`, `seller_state`                                      

  `categories`      `product_category_name`,           None                            None
                    `product_category_name_english`                                    
  ----------------------------------------------------------------------------------------------------------------

The `q` search parameter searches these configured fields:

-   `customers`: `customer_city`, `customer_state`
-   `geolocation`: `geolocation_city`, `geolocation_state`
-   `orderItems`: `order_id`, `product_id`, `seller_id`
-   `payments`: `order_id`, `payment_type`
-   `reviews`: `review_id`, `order_id`, `review_comment_title`,
    `review_comment_message`
-   `orders`: `order_id`, `customer_id`, `order_status`
-   `products`: `product_id`, `product_category_name`
-   `sellers`: `seller_id`, `seller_city`, `seller_state`
-   `categories`: `product_category_name`,
    `product_category_name_english`

## MongoDB Data Notes

-   MongoDB automatically supplies `_id` for inserted documents.
-   IDs and postal/ZIP code prefixes should generally remain strings to
    preserve leading zeros.
-   Numeric range filters convert string fields at query time. For
    larger datasets, consider converting numeric columns to actual
    numeric types during ingestion.
-   Date ranges currently compare formatted strings. For robust date
    analytics, convert date columns to BSON Date values.
-   The order-details endpoint uses `order_id` to associate records
    across the orders, order-items, payments, and reviews collections.

## Deploying to Render

1.  Push the project to a GitHub repository.

2.  In Render, create a new **Web Service** and connect the repository.

3.  Set the build command to:

    ``` text
    npm install
    ```

4.  Set the start command to:

    ``` text
    node server.js
    ```

5.  Add `MONGODB_URL` under the Render service's Environment settings.
    Set `NODE_ENV` to `production` if desired.

6.  Ensure your MongoDB deployment accepts connections from Render. Use
    a suitable Atlas Network Access configuration rather than assuming
    your local IP allowlist will work.

7.  Deploy and test the public service URL, starting with `/`.

Render supplies a `PORT` environment variable, which this application
reads automatically.

## Security and Production Notes

This is a learning/development API and does **not** include
authentication or authorization. Before exposing sensitive data
publicly:

-   Add authentication and access controls.
-   Add rate limiting and request-size limits.
-   Keep `.env` and credentials out of source control.
-   Avoid logging secrets or sensitive request data.
-   Add indexes for frequently queried fields.
-   Review error responses before production; the current handler
    returns error messages to clients.
-   Consider limiting expensive regex searches and large offsets for
    large datasets.

## Troubleshooting

**`MONGODB_URL is missing from .env`**

-   Ensure `.env` is in the same project root as `server.js`.
-   Check the variable name is exactly `MONGODB_URL`.
-   Restart the server after editing `.env`.

**`bad auth: Authentication failed`**

-   Check the MongoDB database username and password.
-   Confirm the connection string's cluster hostname.
-   URL-encode special characters in credentials.
-   Confirm the database user exists in Atlas.

**Connection timeout or server selection error**

-   Check Atlas Network Access and the current network.
-   Verify the cluster is available and the URI is correct.

**`Cannot find module 'express'` or another package**

``` powershell
npm install express mongoose dotenv
```

**Endpoint returns an empty array**

-   Confirm ingestion completed successfully.
-   Check the collection name and database selected by the connection
    string.
-   Try the relevant `/stats` or `/count` endpoint.
-   Verify exact-match values and capitalization where applicable.

------------------------------------------------------------------------

## License

Add a license before distributing this project publicly.
#   s a l e s a p i  
 # salesapi
#   s a l e s a p i  
 #   s a l e s a p i  
 