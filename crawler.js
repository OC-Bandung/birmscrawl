var MongoClient = require("mongodb").MongoClient;
var request = require('request');
var async = require("async");
var hash = require('object-hash');
var isUrl = require('is-url');

var db;

/**
 * Fetches one single contract from given uri parameter. If successful, saves the contract into mongodb
 * If failed, upserts the error into mongo
 * @param uri
 * @param callback
 */
function requestUri(uri, callback) {
    request
        .get({
                url: uri,
                headers: {'Accept': 'application/json'},
                strictSSL: false
            },
            function (err, res, body) {
                if (err != null || res.statusCode !== 200) {
                    var data = {};
                    if (typeof body === 'undefined') {
                        //this means there was probably a http failure without any body returned
                        data.error = err;
                    } else {
                        //only first two errors from the stack are generally relevant
                        data.error = JSON.parse(body).slice(0, 2);
                    }
                    data.uri = uri;
                    updateError(data, callback); //upserts error
                } else {
                    upsertDoc(JSON.parse(body), callback); //all good, inserts contract/release into mongo
                }
            });
}

/**
 * Fetches the list of contracts from given url, gets each uri and invokes a request on the uri.
 * This function is recursive and it will invoke itself for each next page until no more pages are available
 * @param url url towards the list of ocds contracts
 * @param client reference to mongo client, used to close mongo connection when done
 */
function testList(url, client) {
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
        async.eachOfLimit(arr, 5, function (contractLink, key, callback) {
            console.log('Processing ' + key + " " + contractLink.uri);
            requestUri(contractLink.uri, callback);
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
                    testList(body.next_page_url, client);
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
const upsertDoc = function (doc, callback) {
    const col = db.collection("release");
    col.replaceOne({ocid: doc.ocid}, doc, {upsert: true}, function (err, result) {
        callback();
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
            callback();
        });
};

const prepareDb = function (callback) {
    const col = db.collection("release");
    col.createIndex({"ocid": 1}, {unique: true},
        function (err, result) {
            callback();
        });
};


if (isUrl(process.argv[3]) && process.argv[2] !== undefined) {
    MongoClient.connect(process.argv[2], {useNewUrlParser: true}, function (err, client) {
        db = client.db("birms");
        prepareDb(function callback() {
            testList(process.argv[3], client);
        });
    });
} else {
    console.log("Usage crawler.js [mongoUrl] [birmsUrl]");
    process.exit();
}

