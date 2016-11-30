var TimeSeries = require('./timeseries.js').TimeSeries;

var ts = new TimeSeries([]);

var json = '{ "key": "", "timestamps": ["2016-08-31", "2016-09-30", "2016-10-31", "2016-11-30"], "values": [1.23, 1.27, 1.24, 1.31] }';
ts = TimeSeries.fromJsonTimeSeries(JSON.parse(json));

console.log(ts.return().toString());