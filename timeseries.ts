export class JsonTimeSeries {
    constructor(public key: string, public timestamps: string[], public values: number[]) {
    }
}

export class TimeSeriesItem {
    constructor(public timestamp: Date, public value: number) {
    }

    get clone(): TimeSeriesItem {
        return new TimeSeriesItem(this.timestamp, this.value);
    }
}

export class TimeSeries {
    constructor(public items: TimeSeriesItem[] = []) {
        this.name = null;
        this.timestampFormatFun = this.dateToString;
        this.valueFormatFun = (d: number) => d.toFixed(2);
    }

    static fromJsonTimeSeries(ts: JsonTimeSeries): TimeSeries {
        let res = new TimeSeries([]);
        res.name = ts.key;
        for (let i in ts.timestamps) {
            let d = new Date(ts.timestamps[i].substr(0, 10));
            res.items.push(new TimeSeriesItem(d, ts.values[i]));
        }
        return res;
    }

    name: string;
    timestampFormatFun: (d: Date) => string;
    valueFormatFun: (v: number) => string;

    private ticksPerDay: number = 24 * 3600 * 1000;
    private ticksPerYear: number = 365.25 * this.ticksPerDay;

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
        let dt = (this.end.getTime() - this.start.getTime()) / this.ticksPerDay / (this.count - 1);
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
        return d.toISOString().substr(0, 10);
    }

    private bondReturn(d0: TimeSeriesItem, d1: TimeSeriesItem, maturity: number, yearlyCoupons: boolean): number {
        let dt = (d1.timestamp.getTime() - d0.timestamp.getTime()) / this.ticksPerYear;
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