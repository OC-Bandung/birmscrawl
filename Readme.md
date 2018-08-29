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
npm start [mongoUrl] [birmsUrl]
```

Example: `npm start mongodb+srv://user:password@cluster0-roge5.mongodb.net/birms?retryWrites=true https://birms.bandung.go.id/beta/api/contracts/year/2016`
...will fetch all 2016 contracts from the given URL. You must supply user and password to connect to mongodb Atlas Birms Instance.
