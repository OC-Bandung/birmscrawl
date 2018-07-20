Crawlwer that fetches contracts from contract list api , one by one and tests 
if errors are generating while conmtract is printed as json. If errors are produced
it collects them into a mongodb database and categorizes them after error type. 


To install the tool, please invoke

```
npm install
```

You will also need MongoDB server installed and started
After installation the crawler can be started using

```
npm start
```

You can change the start uri by editing the uri in the `testList` function parameter in file `crawler.js` - last line
