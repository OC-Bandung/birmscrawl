var MongoClient = require("mongodb").MongoClient;
var url = 'mongodb://localhost:27017';
var request = require('request');
var rateLimit = require('function-rate-limit');


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


            arr.forEach(rateLimit(1, 1000, function (contractLink) {
                console.log("Requesting " + contractLink.uri);
                request
                    .get({
                            url: contractLink.uri,
                            headers: {'Accept': 'application/json'}
                        },
                        function (err, res, body) {
                            if (err != null || res.statusCode != 200) {
                                var data = {};
                                data.error = JSON.parse(body);
                                data.uri = contractLink.uri;
                                insertDocument(data);
                            }
                        });
            }));


        if (body.next_page_url != null) {
            rateLimit(1, 30000,
                testList(body.next_page_url,col));
        }

    });
}

const insertDocument = function(doc) {

    MongoClient.connect(url, function (err, client) {
        console.log("Connected correctly to mongo server");
        const db = client.db("brims-err");
        const col = db.collection("errors");
        // Insert some documents
        col.insert(doc, function (err, result) {
            console.log("Inserted 1 document into the collection");
            client.close();
        });
    });
}



    var uri = "https://birms.bandung.go.id/beta/api/contracts/year/2016";

    testList(uri);

