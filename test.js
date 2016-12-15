var TimeSeries = require('./timeseries.js').TimeSeries;
var DatePeriod = require('./timeseries.js').DatePeriod;
require('seedrandom');
require('daycount');

Number.prototype.toPercent = function (decimals) {
    if (!isFinite(this) || (Math.abs(this) < 1e-6))
        return '';
    return (100 * this).toFixed(decimals).replace('.', ',') + '%';
}


var json = '{ "key": "", "timestamps": ["2016-08-31", "2016-09-30", "2016-10-31", "2016-11-30"], "values": [1.26, 1.27, 1.28, 1.29] }';
var ts = TimeSeries.fromJsonTimeSeries(JSON.parse(json));

var md = ts.maxDrawdown(false);
console.log((md.values[1] / md.values[0] - 1).toPercent(1) + ', ' + md.timestamps[0].ymd() + ' - ' + md.timestamps[1].ymd());

//console.log([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(d => DatePeriod.fromDate(Date.fromYmd(2016, 12, d), 52).value.toFixed(0)).join(', '));
//var test = (new Date()).date().addDays(0).date().ymdhm();

var d = (new Date()).date();
ts = TimeSeries.generateRandomTimeSeries('ABC', Date.fromYmd(2016, 01, 11), Date.fromYmd(2016, 04, 20), true, 0.1, 0.2, 0, 'X');
console.log(ts.toString());

var syncdates = [0, 1, 2, 3, 4].map(d => Date.fromYmd(2016, d, 1).endOfMonth());
console.log('syncdates: ' + syncdates.map(d => d.ymd()).join(', '));

function testSync(p) {
    var dp = DatePeriod.fromDate(ts.items[1].timestamp, p);
    console.log('syncdates(' + p + '): ' + DatePeriod.range(dp.addPeriod(-1).toDate(), ts.end, p).map(d => d.ymd()).join(', '));
}
[1, 2, 4, 6, 12, 52, 252, 365].forEach(testSync);

function testPeriods(p) {
    var dps = syncdates.map(d => DatePeriod.fromDate(d, p));
    console.log('periods(' + p + '): ' + dps.map(d=>d.value.toFixed(0)).join(', ') + ' => ' +
        dps.map(d => d.toDate().ymd()).join(', ') + ' => ' +
        dps.map(d => d.addPeriod(-1).toDate().ymd()).join(', '));
}
[1, 2, 4, 6, 12, 52, 252, 365].forEach(testPeriods);

function testMethod(m) {
    console.log(m + ': ' + ts.synchronize(syncdates, m).items.map(d=>ts.valueFormatFun(d.value)).join(', '));
}
['exact', 'latest', 'latestOnlyWithinRange', 'latestStartValueBeforeRange'].forEach(testMethod);

