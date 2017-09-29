import "daycount";
import "seedrandom";

declare global {
    interface Math {
        seedrandom(seed: string): void;
    }
}

export class JsonTimeSeries {
    constructor(public key: string, public timestamps: string[], public values: number[]) {
    }
}

export class TimeSeriesItem {
    constructor(timestamp: any, value: number = undefined) {
        var t = timestamp;
        this.value = value;
        if (typeof t == "object") {
            if (TimeSeries.getClassName(t) != "Date") {
                t = timestamp.timestamp;
                this.value = timestamp.value;
            }
        }
        if (typeof t == "string")
            if (/\d{4}-[01]\d-[0-3]\d(?:T[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))?/.test(t))
                t = new Date(t);
        this.timestamp = t;
    }

    timestamp: Date;
    value: number;

    get clone(): TimeSeriesItem {
        return new TimeSeriesItem(this.timestamp, this.value);
    }
}

export class DatePeriod {

    constructor(public value: number, public periodicity: number) {
    }

    private static ticksPerDay: number = 24 * 3600 * 1000;

    static calcValue(d: Date, periodicity: number): number {
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
    }

    static fromDate(d: Date, periodicity: number) {
        return new DatePeriod(DatePeriod.calcValue(d, periodicity), periodicity);
    }

    toDate(): Date {
        if (!isFinite(this.value) || (this.periodicity <= 0))
            return new Date(0);
        if (this.periodicity <= 12) {
            var p = 12 / this.periodicity;
            return Date.fromYmd(1970, p * (this.value + 1) + 1, 1).addDays(-1);
        }
        var d: Date;
        if (this.periodicity == 52) 
            d = new Date((this.value * 7 + 3) * DatePeriod.ticksPerDay);
        else
            d = new Date(this.value * DatePeriod.ticksPerDay);
        return d.date();
    }

    addPeriod(n: number): DatePeriod {
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
    }

    static range(start: Date, end: Date, periodicity: number): Date[] {
        var dp = DatePeriod.fromDate(start, periodicity);
        var dpe = DatePeriod.fromDate(end, periodicity);
        var res: Date[] = [];
        while (dp.value <= dpe.value) {
            res.push(dp.toDate());
            dp.addPeriod(1);
        }
        return res;
    }
}

export class TimeSeries {
    constructor(public items: TimeSeriesItem[] = []) {
        this.items = items.map(d => (TimeSeries.getClassName(d) == "TimeSeriesItem") ? d : new TimeSeriesItem(d));
        this.name = null;
        this.timestampFormatFun = this.dateToString;
        this.valueFormatFun = (d: number) => d.toFixed(2);
    }

    static getClassName(obj) {
        var funcNameRegex = /function (.{1,})\(/;
        var results = (funcNameRegex).exec((obj).constructor.toString());
        return (results && results.length > 1) ? results[1] : "";
    }

    static fromJsonTimeSeries(ts: JsonTimeSeries): TimeSeries {
        let res = new TimeSeries([]);
        res.name = ts.key;
        res.items = ts.timestamps.map((d, i) => new TimeSeriesItem(d, ts.values[i]));
        //for (let i in ts.timestamps) {
        //    //let d = new Date(ts.timestamps[i].substr(0, 10));
        //    res.items.push(new TimeSeriesItem(ts.timestamps[i], ts.values[i]));
        //}
        return res;
    }

    name: string;
    timestampFormatFun: (d: Date) => string;
    valueFormatFun: (v: number) => string;

    private static ticksPerDay: number = 24 * 3600 * 1000;
    private static ticksPerYear: number = 365.25 * TimeSeries.ticksPerDay;
    private static maxDate: Date = new Date(9999999900000);

    // Replaces all properties in the timeseries
    assign(name: string, items: TimeSeriesItem[], tFmtFun: (d: Date) => string, vFmtFun: (v: number) => string): TimeSeries {
        this.name = name;
        this.items = items;
        this.timestampFormatFun = tFmtFun;
        this.valueFormatFun = vFmtFun;
        return this;
    }

    get cloneItems(): TimeSeriesItem[] {
        let items: TimeSeriesItem[] = [];
        this.items.forEach(d => items.push(d.clone));
        return items;
    }

    // Creates a deep copy of the timeseries 
    get clone(): TimeSeries {
        return (new TimeSeries([])).assign(this.name, this.cloneItems, this.timestampFormatFun, this.valueFormatFun);
    }

    // Like Array.slice create a sliced copy of the timeseries, from startDate to endDate
    range(start: Date, end: Date): TimeSeries {
        let res = new TimeSeries([]);
        res.assign(this.name, [], this.timestampFormatFun, this.valueFormatFun);
        for (let i in this.items) {
            var d = this.items[i];
            if ((d.timestamp >= start) && (d.timestamp <= end))
                res.items.push(d.clone);
        }
        return res;
    }

    // Sorts TimeSeriesItems in ascending date order. Which many functions and operations require. Therefore items should always be kept in ascending date order.
    sort(): TimeSeries {
        this.items.sort((a: TimeSeriesItem, b: TimeSeriesItem) => a.timestamp.getTime() - b.timestamp.getTime());
        return this;
    }

    get values(): number[] {
        return this.items.map((d) => d.value);
    }

    get timestamps(): Date[] {
        return this.items.map((d) => d.timestamp);
    }

    get start(): Date {
        if (this.items.length == 0)
            return null;
        return this.items[0].timestamp;
    }

    get end(): Date {
        if (this.items.length == 0)
            return null;
        return this.items[this.items.length - 1].timestamp;
    }

    get startValue(): number {
        if (this.items.length == 0)
            return Number.NaN;
        return this.items[0].value;
    }

    get endValue(): number {
        if (this.items.length == 0)
            return Number.NaN;
        return this.items[this.items.length - 1].value;
    }

    get count(): number {
        return this.items.length;
    }

    // Returns the last index in items, where timestamp >= item.timestamp
    indexOf(t: Date): number {
        if (this.items === undefined)
            return -1;
        let vs = this.items;
        let i: number;
        let n = this.items.length;
        if (n == 0)
            return -1;
        else if (t < vs[0].timestamp)
            return -1;
        else if (t >= vs[n - 1].timestamp)
            return n - 1;

        if (n > 20) { //Binary search if >20 (otherwise it's no gain using it)     
            let hi = n - 1;
            let low = 0;
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
        else { //Incremental search  
            i = 1;
            while ((t >= vs[i].timestamp) && (i < (n - 1)))
                i++;
            return i - 1;
        }
    }

    // Returns value of item found by indexOf()
    latestValue(t: Date): number {
        let idx = this.indexOf(t);
        if (idx == -1)
            return Number.NaN;
        return this.items[idx].value;
    }

    // Number of items per year rounded to one of the standard values 252 (banking daily), 52 (weekly), 12 (monthly), 4 (quarterly), 2 (semi annually), 1 (yearly)
    get periodicity() {
        if (this.count < 2)
            return 0;
        let dt = (this.end.getTime() - this.start.getTime()) / TimeSeries.ticksPerDay / (this.count - 1);
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
    }

    private isFinite(v: number): boolean {
        return typeof v === "number" && isFinite(v);
    }

    private safeLog(v: number) {
        if (!this.isFinite(v))
            return Number.NaN;
        if (v <= 0.0)
            return Number.NaN;
        return Math.log(v);
    }

    // By item value operators
    // These functions / operators modifies each item value and returns a ref to the TimeSeries object itself (for method chaining)

    // Log of each value (safe log, returns Number.NaN if non positive)
    log(): TimeSeries {
        this.items.forEach(d => d.value = this.safeLog(d.value));
        return this;
    }

    // Exp of each value
    exp(): TimeSeries {
        this.items.forEach(d => d.value = Math.exp(d.value));
        return this;
    }

    // Add v to each value
    add(v: number): TimeSeries {
        this.items.forEach(d => d.value += v);
        return this;
    }

    // Mult v to each value
    mult(v: number): TimeSeries {
        this.items.forEach(d => { if (this.isFinite(d.value)) d.value *= v; });
        return this;
    }

    // Negates each value
    neg(): TimeSeries {
        return this.mult(-1.0);
    }

    // 1/x of each value, Number.NaN if == 0
    inverse(): TimeSeries {
        this.items.forEach(d => { if (this.isFinite(d.value) && (d.value != 0.0)) d.value = 1.0 / d.value; });
        return this;
    }

    private diffOperator(items: TimeSeriesItem[], operatorFun: (v0: number, v1: number) => number) {
        if (items.length == 0)
            return this;
        let v0 = items[0].value;
        items.splice(0, 1);
        for (let i = 0; i < items.length; i++) {
            let v1 = items[i].value;
            items[i].value = operatorFun(v0, v1);
            v0 = v1;
        }
        return this;
    }

    // Returns a timeseries one item shorter and with item to item differences
    diff(): TimeSeries {
        return this.diffOperator(this.items, (v0: number, v1: number) => {
            if (this.isFinite(v0) && this.isFinite(v1))
                return v1 - v0;
            return Number.NaN;
        });
    }

    // Returns a timeseries one item shorter and with item to item quotients (returns)
    return(): TimeSeries {
        return this.diffOperator(this.items, (v0: number, v1: number) => {
            if (this.isFinite(v0) && this.isFinite(v1) && (v0 != 0.0))
                return v1 / v0 - 1.0;
            return Number.NaN;
        });
    }

    // Returns a timeseries one item shorter and with item to item log quotients (log returns)
    logReturn(): TimeSeries {
        return this.diffOperator(this.items, (v0: number, v1: number) => {
            if (this.isFinite(v0) && this.isFinite(v1) && (v0 != 0.0))
                return this.safeLog(v1 / v0);
            return Number.NaN;
        });
    }

    private cumOperator(items: TimeSeriesItem[], startValue: number, operatorFun: (v0: number, v1: number) => number) {
        let v = startValue;
        for (let i = 0; i < items.length; i++) {
            v = operatorFun(v, items[i].value);
            items[i].value = v;
        }
        return this;
    }

    cumSum(): TimeSeries {
        return this.cumOperator(this.items, 0.0, (v0: number, v1: number) => {
            if (this.isFinite(v0) && this.isFinite(v1))
                return v0 + v1;
            return Number.NaN;
        });
    }

    cumProd(): TimeSeries {
        return this.cumOperator(this.items, 1.0, (v0: number, v1: number) => {
            if (this.isFinite(v0) && this.isFinite(v1))
                return v0 * v1;
            return Number.NaN;
        });
    }

    get endOfMonth(): TimeSeries {
        let monthNumber = (t: Date) => 100 * t.getFullYear() + t.getMonth();
        let res = this.clone;
        let eom: any = {};
        this.items.forEach((d) => {
            eom[monthNumber(d.timestamp)] = d.clone;
        });
        if (this.items.length > 0) {
            let d0 = this.items[0];
            if (eom[monthNumber(d0.timestamp)].timestamp != d0.timestamp)
                eom[0] = d0;
        }
        res.items = [];
        for (let i in eom) {
            if (!eom.hasOwnProperty(i))
                continue;
            res.items.push(eom[i]);
        }
        res.sort();
        return res;
    }

    toString(): string {
        var res = "";
        if (this.name)
            res += this.name + '\n';
        if (this.items)
            res += this.items.map(d => this.timestampFormatFun(d.timestamp) + " = " + this.valueFormatFun(d.value)).join('\n');
        return res;
    }

    private dateToString(d: Date) {
        d = new Date(d.getTime());
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().substring(0, 10);
    }

    private bondReturn(d0: TimeSeriesItem, d1: TimeSeriesItem, maturity: number, yearlyCoupons: boolean): number {
        let dt = (d1.timestamp.getTime() - d0.timestamp.getTime()) / TimeSeries.ticksPerYear;
        if (maturity <= dt)
            return Math.pow(1.0 + d0.value, dt);
        if (!yearlyCoupons)
            return Math.pow(1.0 + d0.value, maturity) * Math.pow(1.0 + d1.value, dt - maturity);
        let v = 0.0;
        for (let i = 1; i <= maturity; i++)
            v += (((i == maturity) ? 1.0 : 0.0) + d0.value) * Math.pow(1.0 + d1.value, dt - i);
        return v;
    }

    bondTotalReturn(parrates: TimeSeries, maturity: number, yearlyCoupons: boolean): TimeSeries {
        this.items = parrates.cloneItems;
        if (this.items.length == 0)
            return this;
        let v = 1.0;
        this.items[0].value = v;
        for (let i = 1; i < this.items.length; i++) {
            v *= this.bondReturn(parrates.items[i - 1], parrates.items[i], maturity, yearlyCoupons);
            this.items[i].value = v;
        }
        return this;
    }

    static weightedTimeSeries = function (ws: number[], tss: TimeSeries[]) {
        let vs: TimeSeriesItem[] = [];
        for (var i in tss[0].items) {
            let v = 0;
            for (var j in tss) {
                v += ws[j] * tss[j].items[i].value;
            }
            vs.push(new TimeSeriesItem(tss[0].items[i].timestamp, v));
        }
        return new TimeSeries(vs);
    }

    get averageAnnualReturn() {
        if (this.count < 2)
            return 0.0;
        return Math.exp(Math.log(this.endValue / this.startValue) / ((this.count - 1) / this.periodicity)) - 1;
    }

    maxDrawdown(fullTimeSeries: boolean): TimeSeries {
        if (fullTimeSeries === undefined)
            fullTimeSeries = false;
        var max = -9e9;
        var maxindex: number;
        var resetmin: number;
        var drawdown: number;
        var maxdrawdown = 0.0;
        var startindex = 0;
        var endindex = 0;
        var ts: TimeSeriesItem[] = [];
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
        if (!fullTimeSeries && (startindex >= 0) && (endindex>=0)) {
            ts.push(new TimeSeriesItem(this.items[startindex]));
            ts.push(new TimeSeriesItem(this.items[endindex]));
        }
        var res: TimeSeries = new TimeSeries(ts);
        res.name = this.name;
        return res;
    }

    smoother(period: number): TimeSeries {
        if (period === undefined)
            period = 1;
        var sum = 0;
        var res: TimeSeries = this.clone;
        for (var j = 0; j < period; j++) {
            for (var i = 3; i < this.count; i++) {
                res.items[i - 1].value = (res.items[i - 2].value + res.items[i].value) / 2;
            }
        }
        return res;
    }

    // Returns the error function erf(x)
    private erf(x: number) {
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
        var t: number, ty: number, tmp: number, res: number;

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
    }

    // Returns the complmentary error function erfc(x)
    private erfc(x: number) {
        return 1 - this.erf(x);
    }

    // Returns the inverse of the complementary error function
    private erfcinv(p: number) {
        var j = 0;
        var x: number, err: number, t: number, pp: number;
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
    }

    private normalInv(p: number, mean: number, std: number) {
        return -1.41421356237309505 * std * this.erfcinv(2 * p) + mean;
    }

    centralWeightedStdev() {
        var vs = this.values;
        vs.sort((d1, d2) => d1 - d2);
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
        //mean = (swx * swxy - swy * swx2) / a;
        return stdev;
        //{
        //    mean: mean,
        //    stdev: stdev
        //};
    }

    // Plotly support
    toTrace(color: string, props: any) {
        var res: any = {
            x: this.items.map(d => this.timestampFormatFun(d.timestamp)),
            y: this.items.map(d => this.valueFormatFun(d.value)),
            type: 'scatter',
            mode: 'lines',
            marker: {
                size: 7,
                line: { width: 0 }
            },
            line: { width: 2.5 }
        };
        if (color !== undefined)
            res.marker.color = color;
        if (props !== undefined) {
            var keys = Object.keys(props);
            for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                res[k] = props[k];
            }
        }
        return res;
    }

    private static randn(): number {
        var u = 1 - Math.random();
        var v = 1 - Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    // Function generates a test random time series. 
    public static generateRandomTimeSeries(name: string, start: Date, end: Date, onlybusinessdays: boolean, yearlyreturn: number,
        yearlyvolatility: number, autocorrelation: number, seed: string): TimeSeries {
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
    }

    private date(idx: number): Date {
        return this.items[idx].timestamp.date();
    }

    // Method = exact, latestOnlyWithinRange, latest, latestStartValueBeforeRange
    public synchronize(mastertimestamps: Date[], method: string) {
        var res = new TimeSeries(mastertimestamps.map(d => new TimeSeriesItem(d.date(), 0.0)));
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
    }

    // Render functions. To be used in conjunction with D3. Should be lifted out from TimeSeries
    renderTable(d3: any, selector: string) {
        let heads: any = [];
        if (this.name)
            heads.push([this.name]);

        let sel = d3.select(selector).selectAll("tr.head")
            .data(heads);
        sel.select("th.right").text((d: string) => { return d; });

        let a = sel.enter()
            .append("tr")
            .attr("class", "head");
        a.append("th")
            .attr("class", "left");
        a.append("th")
            .attr("class", "right")
            .text((d: string) => { return d; });

        sel.exit().remove();

        sel = d3.select(selector).selectAll("tr.row")
            .data(this.items);

        sel.select("td.left")
            .select("a")
            .attr("href", (d: TimeSeriesItem) => "javascript:filterDate('" + this.dateToString(d.timestamp) + "')")
            .text((d: TimeSeriesItem) => this.timestampFormatFun(d.timestamp));

        sel.select("td.right")
            .text((d: TimeSeriesItem) => this.valueFormatFun(d.value));

        a = sel.enter()
            .append("tr")
            .attr("class", "row");
        a.append("td")
            .attr("class", "left")
            .append("a")
            .attr("href", (d: TimeSeriesItem) => "javascript:filterDate('" + this.dateToString(d.timestamp) + "')")
            .text((d: TimeSeriesItem) => this.timestampFormatFun(d.timestamp));
        a.append("td").attr("class", "right")
            .text((d: TimeSeriesItem) => this.valueFormatFun(d.value));

        sel.exit().remove();
    }

    renderMonthTable(d3: any, selector: string) {
        let monthArray = () => {
            let res: number[] = [];
            for (let i = 0; i < 12; i++)
                res.push(Number.NaN);
            return res;
        };
        let addNewYear = (tbl: any[], y: number): any => {
            let curr = { year: y, values: monthArray() };
            tbl.push(curr);
            return curr;
        };
        let tbl: any[] = [];
        let curr: any = null;
        this.items.forEach((d) => {
            let y = d.timestamp.getFullYear();
            let m = d.timestamp.getMonth();
            if (curr == null)
                curr = addNewYear(tbl, y);
            else if (curr.year != y)
                curr = addNewYear(tbl, y);
            curr.values[m] = d.value;
        });

        let heads: any = [];
        if (tbl.length > 0)
            heads.push(["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"]);
        let sel = d3.select(selector).selectAll("thead")
            .data(heads);
        let a = sel.enter().append("thead").append("tr").attr("class", "head");
        a.append("th");
        a.selectAll("th.month").data((d: any) => { return d; })
            .enter()
            .append("th")
            .attr("class", "month")
            .text((d: string) => { return d; });
        sel.exit().remove();

        let monthValueFormatFun = (d: number) => {
            if (isNaN(d))
                return "";
            else
                return this.valueFormatFun(d);
        };

        var selbody = d3.select(selector).selectAll("tbody")
            .data([{}]);
        selbody.enter().append("tbody");

        sel = selbody.selectAll("tr.year")
            .data(tbl);

        sel.select("td.year")
            .text((d: any) => d.year.toString());
        sel.selectAll("td.month")
            .data((d: any) => d.values)
            .text((d: number) => monthValueFormatFun(d));

        a = sel.enter()
            .append("tr")
            .attr("class", "year");
        a.append("td")
            .attr("class", "year")
            .text((d: any) => d.year.toString());
        a.selectAll("td.month").data((d: any) =>
            d.values
        ).enter()
            .append("td")
            .attr("class", "month")
            .text((d: number) => monthValueFormatFun(d));

        sel.exit().remove();
    }
}

export class Portfolio {
    constructor(public timeSeries: TimeSeries, public benchmarkTimeSeries: TimeSeries,
        public riskFreeTimeSeries: TimeSeries) {
    }
}