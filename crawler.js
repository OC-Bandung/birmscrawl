var MongoClient = require("mongodb").MongoClient;
var url = 'mongodb://localhost:27017';
var request = require('request');
var async = require("async");
var hash = require('object-hash');

function requestUri(uri, callback) {
    request
        .get({
                url: uri,
                headers: {'Accept': 'application/json'}
            },
            function (err, res, body) {
                if (err != null || res.statusCode != 200) {
                    var data = {};
                    if(body==='undefined') {
                        data.error=err;
                    } else {
                        data.error = JSON.parse(body).slice(0,2);
                    }
                    data.uri = uri;
                    updateError(data, callback);
                } else {
                    insertDoc(JSON.parse(body), callback);
                }
            });
}

function testList(url) {
    console.log("Requesting list " + url);
    request(url, function (error, response, body) {
        var body = JSON.parse(body);
        var arr;
        if (Array.isArray(body.data)) {
            arr = body.data;
        } else {
            arr = Object.values(body.data);
        }

        async.eachOfLimit(arr, 4, function (contractLink, key, callback) {
            console.log('Processing '+key+ " " + contractLink.uri);
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
                    testList(body.next_page_url);
                }
            }
        });

    });
}


const insertDoc = function (doc, callback) {
    MongoClient.connect(url, function (err, client) {
        const db = client.db("brims");
        const col = db.collection("release");
        col.insertOne(doc, function (err, result) {
                callback();
                client.close();
            });
    });
};

const updateError = function (doc, callback) {
    MongoClient.connect(url, function (err, client) {
        const db = client.db("brims");
        const col = db.collection("error");
        col.updateOne({md5: hash.MD5(doc.error)}
            , {$set: {error: doc.error}, $addToSet: {uri: doc.uri}}, {upsert: true}, function (err, result) {
                callback();
                client.close();
            });
    });
};


var uri = "https://birms.bandung.go.id/beta/api/contracts/year/2017";
//var uri = "http://127.0.0.1:8000/api/contracts/year/2016";

testList(uri);