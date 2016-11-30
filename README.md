## TimeSeries in TypeScript
TimeSeries is a typescript object designed to keep data and perform calculations on date and value timeseries.

# TimeSeriesItem
The data is stored in an array of TimeSeriesItems, where TimeSeriesItem is basically

```js
{
	timestamp: Date;
	value: number;
}
```

# Json import
By default the TimeSeries class imports json data in the following format.

Example

```json
{
	"key": "any id or name (optional)",
	"timestamps": ["2016-08-31", "2016-09-30", "2016-10-31", "2016-11-30"],
	"values": [1.23, 1.27, 1.24, 1.31]
}
```

Where:
* key: String, any id or name, optional
* timestamps: Array of date strings
* values: Array of numbers

# Core functions
* clone(): Creates a deep copy of the timeseries 
* assign(): Replaces all properties in the timeseries
* range(startDate, endDate): Like Array.slice create a sliced copy of the timeseries, from startDate to endDate
* sort(): Sorts TimeSeriesItems in ascending date order. Which many functions and operations require. Therefore items should always be kept in ascending date order.

# Basic get properties
* values: Array of numbers
* timestamps: Array of Date
* start: First timestamps 
* end: Last timestamps
* startValue: First value
* endValue: Last value
* count: Number of items

# Search functions
* indexOf(): Returns the last index in items, where timestamp >= item.timestamp
* latestValue(): Returns value of item found by indexOf()
