
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const mongoose = require("mongoose");
require("dotenv").config();

const BATCH_SIZE = 1000;

async function ingestCsv(filePath) {
    if (!process.env.MONGODB_URL) {
        throw new Error("MONGODB_URL is missing from .env");
    }

    if (!fs.existsSync(filePath)) {
        throw new Error(`CSV file not found: ${filePath}`);
    }

    // Derive collection name from the filename
    const collectionName = path
        .basename(filePath, path.extname(filePath))
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_");

    console.log("Starting CSV ingestion...");
    console.log(`File: ${filePath}`);
    console.log(`Collection: ${collectionName}`);

    await mongoose.connect(process.env.MONGODB_URL);

    console.log("Connected to MongoDB successfully");

    const collection =
        mongoose.connection.collection(collectionName);

    let batch = [];
    let totalInserted = 0;

    try {
        const stream = fs.createReadStream(filePath)
            .pipe(csv());

        for await (const row of stream) {
            // Each CSV row becomes one MongoDB document
            batch.push(row);

            if (batch.length >= BATCH_SIZE) {
                const result = await collection.insertMany(batch);

                totalInserted += result.insertedCount;
                console.log(
                    `Inserted ${totalInserted} documents...`
                );

                batch = [];
            }
        }

        // Insert any remaining rows
        if (batch.length > 0) {
            const result = await collection.insertMany(batch);
            totalInserted += result.insertedCount;
        }

        console.log("--------------------------------");
        console.log("CSV ingestion completed!");
        console.log(`Collection: ${collectionName}`);
        console.log(`Total documents inserted: ${totalInserted}`);
        console.log("--------------------------------");
    } finally {
        await mongoose.disconnect();
        console.log("MongoDB connection closed");
    }
}

// Get CSV path from the command line
const filePath = process.argv[2];

if (!filePath) {
    console.error(
        "Usage: node ingest.js <path-to-csv-file>"
    );
    process.exitCode = 1;
} else {
    ingestCsv(path.resolve(filePath)).catch((error) => {
        console.error("Ingestion failed:", error.message);
        process.exitCode = 1;
    });
}
