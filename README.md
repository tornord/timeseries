## TimeSeries in TypeScript

TimeSeries is a typescript object designed to keep data and perform calculations on date and value timeseries.

The data is stored in an array of TimeSeriesItems, where TimeSeriesItem is basically

```js
{
	timestamp: Date;
	value: number;
}
```

By default the TimeSeries class imports json data of the following format:

```json
{
	"key": "any id or name (optional)", // Optional
	"timestamps": ["2016-08-31", "2016-09-30", "2016-10-31", "2016-11-30"], // Array of date strings
	"values": [1.23, 1.27, 1.24, 1.31] // Array of numbers
}
```
