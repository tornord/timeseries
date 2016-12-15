"use strict";
require("daycount");
require("seedrandom");
var JsonTimeSeries = (function () {
    function JsonTimeSeries(key, timestamps, values) {
        this.key = key;
        this.timestamps = timestamps;
        this.values = values;
    }
    return JsonTimeSeries;
}());
exports.JsonTimeSeries = JsonTimeSeries;
var TimeSeriesItem = (function () {
    function TimeSeriesItem(timestamp, value) {
        this.timestamp = timestamp;
        this.value = value;
    }
    Object.defineProperty(TimeSeriesItem.prototype, "clone", {
        get: function () {
            return new TimeSeriesItem(this.timestamp, this.value);
        },
        enumerable: true,
        configurable: true
    });
    return TimeSeriesItem;
}());
exports.TimeSeriesItem = TimeSeriesItem;
var DatePeriod = (function () {
    function DatePeriod(value, periodicity) {
        this.value = value;
        this.periodicity = periodicity;
    }
    DatePeriod.calcValue = function (d, periodicity) {
        if (periodicity <= 0)
            return Number.NaN;
        d = d.date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        if (periodicity <= 12) {
            var m = d.monthNumber();
            var p = 12 / periodicity;
            return (m - (m % p)) / p;
        }
        var p = d.getTime() / DatePeriod.ticksPerDay;
        if (periodicity == 52) {
            p += 3;
            return (p - (p % 7)) / 7;
        }
        if (periodicity == 252) {
            if (!d.isBusinessDay())
                d = d.nextBusinessDay();
            p = d.getTime() / DatePeriod.ticksPerDay;
            return p;
        }
        if (periodicity == 365)
            return p;
        return Number.NaN;
    };
    DatePeriod.fromDate = function (d, periodicity) {
        return new DatePeriod(DatePeriod.calcValue(d, periodicity), periodicity);
    };
    DatePeriod.prototype.toDate = function () {
        if (!isFinite(this.value) || (this.periodicity <= 0))
            return new Date(0);
        if (this.periodicity <= 12) {
            var p = 12 / this.periodicity;
            return Date.fromYmd(1970, p * (this.value + 1) + 1, 1).addDays(-1);
        }
        var d;
        if (this.periodicity == 52)
            d = new Date((this.value * 7 + 3) * DatePeriod.ticksPerDay);
        else
            d = new Date(this.value * DatePeriod.ticksPerDay);
        return d.date();
    };
    DatePeriod.prototype.addPeriod = function (n) {
        if (this.periodicity != 252) {
            this.value += n;
        }
        else {
            var d = this.toDate();
            while (n > 0) {
                d = d.nextBusinessDay();
                n--;
            }
            while (n < 0) {
                d = d.previousBusinessDay();
                n++;
            }
            this.value = DatePeriod.calcValue(d, this.periodicity);
        }
        return this;
    };
    DatePeriod.range = function (start, end, periodicity) {
        var dp = DatePeriod.fromDate(start, periodicity);
        var dpe = DatePeriod.fromDate(end, periodicity);
        var res = [];
        while (dp.value <= dpe.value) {
            res.push(dp.toDate());
            dp.addPeriod(1);
        }
        return res;
    };
    DatePeriod.ticksPerDay = 24 * 3600 * 1000;
    return DatePeriod;
}());
exports.DatePeriod = DatePeriod;
var TimeSeries = (function () {
    function TimeSeries(items) {
        if (items === void 0) { items = []; }
        this.items = items;
        this.name = null;
        this.timestampFormatFun = this.dateToString;
        this.valueFormatFun = function (d) { return d.toFixed(2); };
    }
    TimeSeries.fromJsonTimeSeries = function (ts) {
        var res = new TimeSeries([]);
        res.name = ts.key;
        for (var i in ts.timestamps) {
            var d = new Date(ts.timestamps[i].substr(0, 10));
            res.items.push(new TimeSeriesItem(d, ts.values[i]));
        }
        return res;
    };
    TimeSeries.prototype.assign = function (name, items, tFmtFun, vFmtFun) {
        this.name = name;
        this.items = items;
        this.timestampFormatFun = tFmtFun;
        this.valueFormatFun = vFmtFun;
        return this;
    };
    Object.defineProperty(TimeSeries.prototype, "cloneItems", {
        get: function () {
            var items = [];
            this.items.forEach(function (d) { return items.push(d.clone); });
            return items;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(TimeSeries.prototype, "clone", {
        get: function () {
            return (new TimeSeries([])).assign(this.name, this.cloneItems, this.timestampFormatFun, this.valueFormatFun);
        },
        enumerable: true,
        configurable: true
    });
    TimeSeries.prototype.range = function (start, end) {
        var res = new TimeSeries([]);
        res.assign(this.name, [], this.timestampFormatFun, this.valueFormatFun);
        for (var i in this.items) {
            var d = this.items[i];
            if ((d.timestamp >= start) && (d.timestamp <= end))
                res.items.push(d.clone);
        }
        return res;
    };
    TimeSeries.prototype.sort = function () {
        this.items.sort(function (a, b) { return a.timestamp.getTime() - b.timestamp.getTime(); });
        return this;
    };
    Object.defineProperty(TimeSeries.prototype, "values", {
        get: function () {
            return this.items.map(function (d) { return d.value; });
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(TimeSeries.prototype, "timestamps", {
        get: function () {
            return this.items.map(function (d) { return d.timestamp; });
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(TimeSeries.prototype, "start", {
        get: function () {
            if (this.items.length == 0)
                return null;
            return this.items[0].timestamp;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(TimeSeries.prototype, "end", {
        get: function () {
            if (this.items.length == 0)
                return null;
            return this.items[this.items.length - 1].timestamp;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(TimeSeries.prototype, "startValue", {
        get: function () {
            if (this.items.length == 0)
                return Number.NaN;
            return this.items[0].value;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(TimeSeries.prototype, "endValue", {
        get: function () {
            if (this.items.length == 0)
                return Number.NaN;
            return this.items[this.items.length - 1].value;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(TimeSeries.prototype, "count", {
        get: function () {
            return this.items.length;
        },
        enumerable: true,
        configurable: true
    });
    TimeSeries.prototype.indexOf = function (t) {
        if (this.items === undefined)
            return -1;
        var vs = this.items;
        var i;
        var n = this.items.length;
        if (n == 0)
            return -1;
        else if (t < vs[0].timestamp)
            return -1;
        else if (t >= vs[n - 1].timestamp)
            return n - 1;
        if (n > 20) {
            var hi = n - 1;
            var low = 0;
            if (t >= vs[hi].timestamp)
                return hi;
            while (hi > (low + 1)) {
                i = Math.floor((hi + low) / 2);
                if (t >= vs[i].timestamp)
                    low = i;
                else {
                    hi = i;
                    i = low;
                }
            }
            return i;
        }
        else {
            i = 1;
            while ((t >= vs[i].timestamp) && (i < (n - 1)))
                i++;
            return i - 1;
        }
    };
    TimeSeries.prototype.latestValue = function (t) {
        var idx = this.indexOf(t);
        if (idx == -1)
            return Number.NaN;
        return this.items[idx].value;
    };
    Object.defineProperty(TimeSeries.prototype, "periodicity", {
        get: function () {
            if (this.count < 2)
                return 0;
            var dt = (this.end.getTime() - this.start.getTime()) / TimeSeries.ticksPerDay / (this.count - 1);
            if (dt == 0.0)
                return 0;
            var peryear = 365.25 / dt;
            if (peryear > 200.0)
                return 252.0;
            if (peryear > 40.0)
                return 52.0;
            if (peryear > 10.0)
                return 12.0;
            if (peryear > 3.0)
                return 4.0;
            if (peryear > 1.5)
                return 2.0;
            return 1.0;
        },
        enumerable: true,
        configurable: true
    });
    TimeSeries.prototype.isFinite = function (v) {
        return typeof v === "number" && isFinite(v);
    };
    TimeSeries.prototype.safeLog = function (v) {
        if (!this.isFinite(v))
            return Number.NaN;
        if (v <= 0.0)
            return Number.NaN;
        return Math.log(v);
    };
    TimeSeries.prototype.log = function () {
        var _this = this;
        this.items.forEach(function (d) { return d.value = _this.safeLog(d.value); });
        return this;
    };
    TimeSeries.prototype.exp = function () {
        this.items.forEach(function (d) { return d.value = Math.exp(d.value); });
        return this;
    };
    TimeSeries.prototype.add = function (v) {
        this.items.forEach(function (d) { return d.value += v; });
        return this;
    };
    TimeSeries.prototype.mult = function (v) {
        var _this = this;
        this.items.forEach(function (d) { if (_this.isFinite(d.value))
            d.value *= v; });
        return this;
    };
    TimeSeries.prototype.neg = function () {
        return this.mult(-1.0);
    };
    TimeSeries.prototype.inverse = function () {
        var _this = this;
        this.items.forEach(function (d) { if (_this.isFinite(d.value) && (d.value != 0.0))
            d.value = 1.0 / d.value; });
        return this;
    };
    TimeSeries.prototype.diffOperator = function (items, operatorFun) {
        if (items.length == 0)
            return this;
        var v0 = items[0].value;
        items.splice(0, 1);
        for (var i = 0; i < items.length; i++) {
            var v1 = items[i].value;
            items[i].value = operatorFun(v0, v1);
            v0 = v1;
        }
        return this;
    };
    TimeSeries.prototype.diff = function () {
        var _this = this;
        return this.diffOperator(this.items, function (v0, v1) {
            if (_this.isFinite(v0) && _this.isFinite(v1))
                return v1 - v0;
            return Number.NaN;
        });
    };
    TimeSeries.prototype.return = function () {
        var _this = this;
        return this.diffOperator(this.items, function (v0, v1) {
            if (_this.isFinite(v0) && _this.isFinite(v1) && (v0 != 0.0))
                return v1 / v0 - 1.0;
            return Number.NaN;
        });
    };
    TimeSeries.prototype.logReturn = function () {
        var _this = this;
        return this.diffOperator(this.items, function (v0, v1) {
            if (_this.isFinite(v0) && _this.isFinite(v1) && (v0 != 0.0))
                return _this.safeLog(v1 / v0);
            return Number.NaN;
        });
    };
    TimeSeries.prototype.cumOperator = function (items, startValue, operatorFun) {
        var v = startValue;
        for (var i = 0; i < items.length; i++) {
            v = operatorFun(v, items[i].value);
            items[i].value = v;
        }
        return this;
    };
    TimeSeries.prototype.cumSum = function () {
        var _this = this;
        return this.cumOperator(this.items, 0.0, function (v0, v1) {
            if (_this.isFinite(v0) && _this.isFinite(v1))
                return v0 + v1;
            return Number.NaN;
        });
    };
    TimeSeries.prototype.cumProd = function () {
        var _this = this;
        return this.cumOperator(this.items, 1.0, function (v0, v1) {
            if (_this.isFinite(v0) && _this.isFinite(v1))
                return v0 * v1;
            return Number.NaN;
        });
    };
    Object.defineProperty(TimeSeries.prototype, "endOfMonth", {
        get: function () {
            var monthNumber = function (t) { return 100 * t.getFullYear() + t.getMonth(); };
            var res = this.clone;
            var eom = {};
            this.items.forEach(function (d) {
                eom[monthNumber(d.timestamp)] = d.clone;
            });
            if (this.items.length > 0) {
                var d0 = this.items[0];
                if (eom[monthNumber(d0.timestamp)].timestamp != d0.timestamp)
                    eom[0] = d0;
            }
            res.items = [];
            for (var i in eom) {
                if (!eom.hasOwnProperty(i))
                    continue;
                res.items.push(eom[i]);
            }
            res.sort();
            return res;
        },
        enumerable: true,
        configurable: true
    });
    TimeSeries.prototype.toString = function () {
        var _this = this;
        var res = "";
        if (this.name)
            res += this.name + '\n';
        if (this.items)
            res += this.items.map(function (d) { return _this.timestampFormatFun(d.timestamp) + " = " + _this.valueFormatFun(d.value); }).join('\n');
        return res;
    };
    TimeSeries.prototype.dateToString = function (d) {
        d = new Date(d.getTime());
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().substring(0, 10);
    };
    TimeSeries.prototype.bondReturn = function (d0, d1, maturity, yearlyCoupons) {
        var dt = (d1.timestamp.getTime() - d0.timestamp.getTime()) / TimeSeries.ticksPerYear;
        if (maturity <= dt)
            return Math.pow(1.0 + d0.value, dt);
        if (!yearlyCoupons)
            return Math.pow(1.0 + d0.value, maturity) * Math.pow(1.0 + d1.value, dt - maturity);
        var v = 0.0;
        for (var i = 1; i <= maturity; i++)
            v += (((i == maturity) ? 1.0 : 0.0) + d0.value) * Math.pow(1.0 + d1.value, dt - i);
        return v;
    };
    TimeSeries.prototype.bondTotalReturn = function (parrates, maturity, yearlyCoupons) {
        this.items = parrates.cloneItems;
        if (this.items.length == 0)
            return this;
        var v = 1.0;
        this.items[0].value = v;
        for (var i = 1; i < this.items.length; i++) {
            v *= this.bondReturn(parrates.items[i - 1], parrates.items[i], maturity, yearlyCoupons);
            this.items[i].value = v;
        }
        return this;
    };
    Object.defineProperty(TimeSeries.prototype, "averageAnnualReturn", {
        get: function () {
            if (this.count < 2)
                return 0.0;
            return Math.exp(Math.log(this.endValue / this.startValue) / ((this.count - 1) / this.periodicity)) - 1;
        },
        enumerable: true,
        configurable: true
    });
    TimeSeries.prototype.maxDrawdown = function (fullTimeSeries) {
        if (fullTimeSeries === undefined)
            fullTimeSeries = false;
        var max = -9e9;
        var maxindex;
        var resetmin;
        var drawdown;
        var maxdrawdown = 0.0;
        var startindex = 0;
        var endindex = 0;
        var ts = [];
        for (var i = 0; i < this.count; i++) {
            var d = this.items[i];
            var v = d.value;
            if (v > max) {
                max = v;
                maxindex = i;
            }
            drawdown = v / max - 1.0;
            if (drawdown < maxdrawdown) {
                maxdrawdown = drawdown;
                startindex = maxindex;
                endindex = i;
            }
            if (fullTimeSeries)
                ts.push(new TimeSeriesItem(d.timestamp, drawdown));
        }
        if (!fullTimeSeries && (startindex >= 0) && (endindex >= 0)) {
            ts.push(this.items[startindex].clone);
            ts.push(this.items[endindex].clone);
        }
        var res = new TimeSeries(ts);
        res.name = this.name;
        return res;
    };
    TimeSeries.prototype.smoother = function (period) {
        if (period === undefined)
            period = 1;
        var sum = 0;
        var res = this.clone;
        for (var j = 0; j < period; j++) {
            for (var i = 3; i < this.count; i++) {
                res.items[i - 1].value = (res.items[i - 2].value + res.items[i].value) / 2;
            }
        }
        return res;
    };
    TimeSeries.prototype.erf = function (x) {
        var cof = [-1.3026537197817094, 6.4196979235649026e-1, 1.9476473204185836e-2,
            -9.561514786808631e-3, -9.46595344482036e-4, 3.66839497852761e-4,
            4.2523324806907e-5, -2.0278578112534e-5, -1.624290004647e-6,
            1.303655835580e-6, 1.5626441722e-8, -8.5238095915e-8,
            6.529054439e-9, 5.059343495e-9, -9.91364156e-10,
            -2.27365122e-10, 9.6467911e-11, 2.394038e-12,
            -6.886027e-12, 8.94487e-13, 3.13092e-13,
            -1.12708e-13, 3.81e-16, 7.106e-15,
            -1.523e-15, -9.4e-17, 1.21e-16,
            -2.8e-17];
        var j = cof.length - 1;
        var isneg = false;
        var d = 0;
        var dd = 0;
        var t, ty, tmp, res;
        if (x < 0) {
            x = -x;
            isneg = true;
        }
        t = 2 / (2 + x);
        ty = 4 * t - 2;
        for (; j > 0; j--) {
            tmp = d;
            d = ty * d - dd + cof[j];
            dd = tmp;
        }
        res = t * Math.exp(-x * x + 0.5 * (cof[0] + ty * d) - dd);
        return isneg ? res - 1 : 1 - res;
    };
    TimeSeries.prototype.erfc = function (x) {
        return 1 - this.erf(x);
    };
    TimeSeries.prototype.erfcinv = function (p) {
        var j = 0;
        var x, err, t, pp;
        if (p >= 2)
            return -100;
        if (p <= 0)
            return 100;
        pp = (p < 1) ? p : 2 - p;
        t = Math.sqrt(-2 * Math.log(pp / 2));
        x = -0.70711 * ((2.30753 + t * 0.27061) /
            (1 + t * (0.99229 + t * 0.04481)) - t);
        for (; j < 2; j++) {
            err = this.erfc(x) - pp;
            x += err / (1.12837916709551257 * Math.exp(-x * x) - x * err);
        }
        return (p < 1) ? x : -x;
    };
    TimeSeries.prototype.normalInv = function (p, mean, std) {
        return -1.41421356237309505 * std * this.erfcinv(2 * p) + mean;
    };
    TimeSeries.prototype.centralWeightedStdev = function () {
        var vs = this.values;
        vs.sort(function (d1, d2) { return d1 - d2; });
        var swx = 0.0;
        var swx2 = 0.0;
        var sw = 0.0;
        var swy = 0.0;
        var swxy = 0.0;
        var n = vs.length;
        for (var i = 0; i < n; i++) {
            var u = (i + 0.5) / n;
            var x = this.normalInv(u, 0, 1);
            var w = (1 + Math.cos(2 * Math.PI * (u - 0.5))) / 2;
            var y = vs[i];
            var xw = x * w;
            swx += xw;
            swx2 += xw * x;
            sw += w;
            swy += w * y;
            swxy += xw * y;
        }
        var a = swx * swx - swx2 * sw;
        var stdev = (swy * swx - swxy * sw) / a;
        return stdev;
    };
    TimeSeries.prototype.toTrace = function (color, props) {
        var _this = this;
        var res = {
            x: this.items.map(function (d) { return _this.timestampFormatFun(d.timestamp); }),
            y: this.items.map(function (d) { return _this.valueFormatFun(d.value); }),
            type: 'scatter',
            mode: 'lines',
            marker: {
                color: color,
                size: 7,
                line: { width: 0 }
            },
            line: { width: 2.5 }
        };
        if (props !== undefined) {
            var keys = Object.keys(props);
            for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                res[k] = props[k];
            }
        }
        return res;
    };
    TimeSeries.randn = function () {
        var u = 1 - Math.random();
        var v = 1 - Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    };
    TimeSeries.generateRandomTimeSeries = function (name, start, end, onlybusinessdays, yearlyreturn, yearlyvolatility, autocorrelation, seed) {
        Math.seedrandom(seed);
        var d = start;
        var ds = new Array();
        var v = 100.0;
        var c0 = 0.0;
        var n = 365.0;
        if (onlybusinessdays) {
            n = 252.0;
            if (!d.isBusinessDay())
                d = d.nextBusinessDay();
        }
        var sigma = yearlyvolatility / Math.sqrt(n);
        var r = Math.pow(1.0 + yearlyreturn, 1.0 / n) - 1.0 - sigma * sigma / 2.0;
        while (d <= end) {
            ds.push(new TimeSeriesItem(d, Math.round(100 * v) / 100));
            var c = sigma * TimeSeries.randn();
            v *= 1.0 + r + c + autocorrelation * c0;
            c0 = c;
            if (onlybusinessdays)
                d = d.nextBusinessDay();
            else
                d = d.addDays(1);
        }
        var res = new TimeSeries(ds);
        res.name = name;
        return res;
    };
    TimeSeries.prototype.date = function (idx) {
        return this.items[idx].timestamp.date();
    };
    TimeSeries.prototype.synchronize = function (mastertimestamps, method) {
        var res = new TimeSeries(mastertimestamps.map(function (d) { return new TimeSeriesItem(d.date(), 0.0); }));
        res.name = this.name;
        res.timestampFormatFun = this.timestampFormatFun;
        res.valueFormatFun = this.valueFormatFun;
        var n = this.count;
        if (n == 0)
            return res;
        var j = 0;
        var st = this.date(j);
        var stn = ((j + 1) < n) ? this.date(j + 1) : TimeSeries.maxDate;
        for (var i = 0; i < res.count; i++) {
            var item = res.items[i];
            var t = item.timestamp.date();
            while (stn.getTime() <= t.getTime()) {
                st = stn;
                j++;
                stn = ((j + 1) < n) ? this.date(j + 1) : TimeSeries.maxDate;
            }
            var v = this.items[j].value;
            var sv = Number.NaN;
            if ((st.getTime() > t.getTime()) && (method == 'latestStartValueBeforeRange'))
                sv = v;
            else if ((st.getTime() == t.getTime()) || ((method != 'exact') && (st.getTime() < t.getTime())))
                sv = (j < n) ? v : Number.NaN;
            if (method == 'latestOnlyWithinRange')
                if ((st.getTime() < t.getTime()) && (stn.getTime() == TimeSeries.maxDate.getTime()))
                    sv = Number.NaN;
            item.value = sv;
        }
        return res;
    };
    TimeSeries.prototype.renderTable = function (d3, selector) {
        var _this = this;
        var heads = [];
        if (this.name)
            heads.push([this.name]);
        var sel = d3.select(selector).selectAll("tr.head")
            .data(heads);
        sel.select("th.right").text(function (d) { return d; });
        var a = sel.enter()
            .append("tr")
            .attr("class", "head");
        a.append("th")
            .attr("class", "left");
        a.append("th")
            .attr("class", "right")
            .text(function (d) { return d; });
        sel.exit().remove();
        sel = d3.select(selector).selectAll("tr.row")
            .data(this.items);
        sel.select("td.left")
            .select("a")
            .attr("href", function (d) { return "javascript:filterDate('" + _this.dateToString(d.timestamp) + "')"; })
            .text(function (d) { return _this.timestampFormatFun(d.timestamp); });
        sel.select("td.right")
            .text(function (d) { return _this.valueFormatFun(d.value); });
        a = sel.enter()
            .append("tr")
            .attr("class", "row");
        a.append("td")
            .attr("class", "left")
            .append("a")
            .attr("href", function (d) { return "javascript:filterDate('" + _this.dateToString(d.timestamp) + "')"; })
            .text(function (d) { return _this.timestampFormatFun(d.timestamp); });
        a.append("td").attr("class", "right")
            .text(function (d) { return _this.valueFormatFun(d.value); });
        sel.exit().remove();
    };
    TimeSeries.prototype.renderMonthTable = function (d3, selector) {
        var _this = this;
        var monthArray = function () {
            var res = [];
            for (var i = 0; i < 12; i++)
                res.push(Number.NaN);
            return res;
        };
        var addNewYear = function (tbl, y) {
            var curr = { year: y, values: monthArray() };
            tbl.push(curr);
            return curr;
        };
        var tbl = [];
        var curr = null;
        this.items.forEach(function (d) {
            var y = d.timestamp.getFullYear();
            var m = d.timestamp.getMonth();
            if (curr == null)
                curr = addNewYear(tbl, y);
            else if (curr.year != y)
                curr = addNewYear(tbl, y);
            curr.values[m] = d.value;
        });
        var heads = [];
        if (tbl.length > 0)
            heads.push(["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"]);
        var sel = d3.select(selector).selectAll("thead")
            .data(heads);
        var a = sel.enter().append("thead").append("tr").attr("class", "head");
        a.append("th");
        a.selectAll("th.month").data(function (d) { return d; })
            .enter()
            .append("th")
            .attr("class", "month")
            .text(function (d) { return d; });
        sel.exit().remove();
        var monthValueFormatFun = function (d) {
            if (isNaN(d))
                return "";
            else
                return _this.valueFormatFun(d);
        };
        var selbody = d3.select(selector).selectAll("tbody")
            .data([{}]);
        selbody.enter().append("tbody");
        sel = selbody.selectAll("tr.year")
            .data(tbl);
        sel.select("td.year")
            .text(function (d) { return d.year.toString(); });
        sel.selectAll("td.month")
            .data(function (d) { return d.values; })
            .text(function (d) { return monthValueFormatFun(d); });
        a = sel.enter()
            .append("tr")
            .attr("class", "year");
        a.append("td")
            .attr("class", "year")
            .text(function (d) { return d.year.toString(); });
        a.selectAll("td.month").data(function (d) {
            return d.values;
        }).enter()
            .append("td")
            .attr("class", "month")
            .text(function (d) { return monthValueFormatFun(d); });
        sel.exit().remove();
    };
    TimeSeries.ticksPerDay = 24 * 3600 * 1000;
    TimeSeries.ticksPerYear = 365.25 * TimeSeries.ticksPerDay;
    TimeSeries.maxDate = new Date(9999999900000);
    TimeSeries.weightedTimeSeries = function (ws, tss) {
        var vs = [];
        for (var i in tss[0].items) {
            var v = 0;
            for (var j in tss) {
                v += ws[j] * tss[j].items[i].value;
            }
            vs.push(new TimeSeriesItem(tss[0].items[i].timestamp, v));
        }
        return new TimeSeries(vs);
    };
    return TimeSeries;
}());
exports.TimeSeries = TimeSeries;
var Portfolio = (function () {
    function Portfolio(timeSeries, benchmarkTimeSeries, riskFreeTimeSeries) {
        this.timeSeries = timeSeries;
        this.benchmarkTimeSeries = benchmarkTimeSeries;
        this.riskFreeTimeSeries = riskFreeTimeSeries;
    }
    return Portfolio;
}());
exports.Portfolio = Portfolio;
//# sourceMappingURL=timeseries.js.map