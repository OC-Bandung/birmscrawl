Crawler that fetches contracts from contract list api , one by one and tests 
if errors are generating while contract is printed as json. If errors are produced
it collects them into a mongodb database and categorizes them after error type. 


To install the tool, please invoke

```
npm install
```

You will also need MongoDB server installed and started
After installation the crawler can be started using

```
npm start [mongoUrl] [birmsUrl|retry] [collection <release,package> - default is release]
```

Example: `npm start mongodb+srv://user:password@cluster0-roge5.mongodb.net/birms https://birms.bandung.go.id/beta/api/contracts/year/2016`
...will fetch all 2016 contracts from the given URL. You must supply user and password to connect to mongodb Atlas Birms Instance.

Example for fetching packages

Example: `npm start mongodb+srv://user:password@cluster0-roge5.mongodb.net/birms http://birms.bandung.go.id/beta/api/packages/year/2016 package`
...will fetch all 2016 release-packages from the given URL. You must supply user and password to connect to mongodb Atlas Birms Instance.


Example for retrying all downloads that produced errors:

```
npm start mongodb+srv://user:password@cluster0-roge5.mongodb.net/birms retry
```

Please be aware retrying errored downloads will NOT result in also cleaning the error collection. It will  just take
all the URLs that were attempted to be fetched and failed and try to re-fetch them. You are advised to check the error collection
manually and decide what to do next, clean it or retry the failed downloads. The cleanup can be manually done using 

```
npm start mongodb+srv://user:password@cluster0-roge5.mongodb.net/birms clean
```

Find differences between packages and releases collections:

`db.package.aggregate( [ { $unwind: "$releases" }, {$project: {"ocid" :"$releases.ocid", _id:0}}, {$lookup: { from: "release", localField: "ocid", foreignField: "ocid" , as: "r" } }, {$match:  {"r": {$eq: [] }  }},  {$project: {"ocid":1} } ]);`

`db.release.aggregate( [ {$project: {"ocid" : 1, _id:0}}, {$lookup: { from: "package", localField: "ocid", foreignField: "releases.ocid" , as: "r" } }, {$match:  {"r": {$eq: [] }  }},  {$project: {"r.ocid":1} } ]);`
