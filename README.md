## TimeSeries TypeScript

TimeSeries is a typescript object designed to keep data and perform date och value timeseries calculations.

The data is stored in an array of TimeSeriesItems, where TimeSeriesItem is basically

```js
{
	timestamp: Date;
	value: number;
}
```
