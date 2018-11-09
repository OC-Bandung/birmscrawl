var MongoClient = require("mongodb").MongoClient;
var request = require('request');
var async = require("async");
var hash = require('object-hash');
var isUrl = require('is-url');

const asyncQueue = 5;
var db;

/**
 * Fetches one single contract from given uri parameter. If successful, saves the contract into mongodb
 * If failed, upserts the error into mongo
 * @param uri
 * @param callback
 */
function requestUri(uri, callback, collection) {
    request
        .get({
                url: uri,
                headers: {'Accept': 'application/json'},
                strictSSL: false
            },
            function (err, res, body) {
                if (uri.includes('43122')) {
                    console.log(uri);
                }
                if (err != null || res.statusCode !== 200) {
                    var data = {};
                    if (typeof body === 'undefined') {
                        //this means there was probably a http failure without any body returned
                        data.error = err;
                    } else {
                        //only first two errors from the stack are generally relevant
                        data.error = JSON.parse(body.replace(/\$ref/g, 'ref').replace(/\$schema/g, 'schema')).slice(0, 2);
                    }
                    data.uri = uri;
                    updateError(data, callback); //upserts error
                } else {
                    upsertDoc(JSON.parse(body), callback, collection); //all good, inserts contract/release into mongo
                }
            });
}

/**
 * Fetches the list of contracts from given url, gets each uri and invokes a request on the uri.
 * This function is recursive and it will invoke itself for each next page until no more pages are available
 * @param url url towards the list of ocds contracts
 * @param client reference to mongo client, used to close mongo connection when done
 * @param collection the type of the content - eg 'release', 'package'
 */
function testList(url, client, collection) {
    console.log("Requesting list " + url);
    request({url: url, strictSSL: false}, function (error, response, b) {
        var body = JSON.parse(b);
        var arr;
        if (Array.isArray(body.data)) {
            arr = body.data;
        } else {
            arr = Object.values(body.data);
        }

        //we iterate in an async fashion the array, with a limit of 5 current "threads" so we do not choke the server
        async.eachOfLimit(arr, asyncQueue, function (contractLink, key, callback) {
            console.log('Processing ' + key + " " + contractLink.uri);
            requestUri(contractLink.uri, callback, collection);
        }, function (err) {
            // if any of the uri processing produced an error, err would equal that error
            if (err) {
                // One of the iterations produced an error.
                // All processing will now stop.
                console.log('Error during page processing');
            } else {
                console.log('All urls have been processed successfully for ' + url);
                //move to next page
                if (body.next_page_url != null) {
                    testList(body.next_page_url, client, collection);
                } else {
                    client.close();
                    process.exit();
                }
            }
        });

    });
}


/**
 * Upserts contract into mongo
 * @param doc the contract (release) to be inserted
 * @param callback the callback when done
 */
const upsertDoc = function (doc, callback, collection) {
    const col = db.collection(collection);
    const upsertId = (collection === "release" ? {ocid: doc.ocid} : {uri: doc.uri});
    col.replaceOne(upsertId, doc, {upsert: true}, function (err, result) {
        if (err !== null) {
            throw "Error upserting doc " + doc.ocid + " " + err;
        }
        callback();
    });
};


const retryErrorLog = function () {
    const col = db.collection("error");
    col.aggregate([{$unwind: "$uri"}, {$project: {uri: 1, _id: 0}}, {$group: {_id: "$uri"}}]).toArray()
        .then(arr => {
            async.eachOfLimit(arr, asyncQueue, function (uriObj, key, callback) {
                console.log('Processing ' + key + " " + uriObj._id);
                requestUri(uriObj._id, callback, uriObj._id.includes("package") ? "package" : "release");
            }, function (err) {
                // if any of the uri processing produced an error, err would equal that error
                if (err) {
                    // One of the iterations produced an error.
                    // All processing will now stop.
                    console.log('Fatal errors during processing!');
                } else {
                    console.log('All urls have been processed successfully!');
                    process.exit();
                }
            });
        });
};

const deleteErrorLog = function() {
    const col = db.collection("error");
    col.remove({}, function(callback) {
        console.log('Removed error log!');
        process.exit();
    });
};

/**
 * Updates or inserts (upserts) an an error , adds to the uri array the new uri where the error happened again, if
 * necessary
 * @param doc the error document to be updated
 * @param callback
 */
const updateError = function (doc, callback) {
    const col = db.collection("error");
    col.updateOne({md5: hash.MD5(doc.error)}
        , {$set: {error: doc.error}, $addToSet: {uri: doc.uri}}, {upsert: true}, function (err, result) {
            if (err !== null) {
                throw "Error upserting error for " + JSON.stringify(doc) + " " + err;
            }
            callback();
        });
};

const prepareDb = function (callback, collection) {

    const rcol = db.collection(collection);
    const iname = (collection === "release" ? "ocid" : "releases.ocid");

    rcol.createIndex({[iname]: 1}, {unique: true},
        function (err, result) {
            if (err !== null) {
                throw err;
            }
            const ecol = db.collection("error");
            ecol.createIndex({"md5": 1}, {unique: true},
                function (err, result) {
                    if (err !== null) {
                        throw err;
                    }
                    if (collection !== "release") {
                        rcol.createIndex({uri: 1}, {unique: true}, callback);
                    } else {
                        callback();
                    }
                });
        });
};



//argv[2] = mongourl
//argv[3] = fetch url | retry
//argv[4] = collection
if (process.argv[2] !== undefined) {
    if (isUrl(process.argv[3])) {
        const url = process.argv[3];
        const collection = (process.argv[4] === undefined ? "release" : process.argv[4]);
        MongoClient.connect(process.argv[2], {useNewUrlParser: true}, function (err, client) {
            db = client.db("birms");
            prepareDb(function callback() {
                testList(url, client, collection);
            }, collection);
        });
    } else {
        if (process.argv[3] === "retry") {
            console.log("Retrying failed urls from the error log...");
            MongoClient.connect(process.argv[2], {useNewUrlParser: true}, function (err, client) {
                db = client.db("birms");
                retryErrorLog();
            });
        }

        if (process.argv[3] === "clean") {
            MongoClient.connect(process.argv[2], {useNewUrlParser: true}, function (err, client) {
                db = client.db("birms");
                deleteErrorLog();
            });
        }
    }
} else {
    process.exit();
}
