import {Component, OnInit, Input, ViewChild, ElementRef, Output, EventEmitter, AfterViewInit, OnDestroy} from '@angular/core';
import {ClusterModel} from '../../models/cluster.model';
import {Subject, Subscription} from 'rxjs';
import {debounceTime} from 'rxjs/operators';
import { chart } from 'highcharts';
import * as Highcharts from 'highcharts';
import {GraphService} from '../../services/graph.service';
import {VirtualScrollerComponent} from 'ngx-virtual-scroller';
import {D3HistogramComponent} from './d3Histogram/d3Histogram.component';

@Component({
    selector: 'app-graph',
    templateUrl: './graph.component.html',
    styleUrls: ['./graph.component.css']
})
export class GraphComponent implements OnInit, AfterViewInit, OnDestroy {

    @Input() _case: string;
    @Input() _filter: string;
    @Input() _clusters: ClusterModel[] = [];
    @Input() _frequency: string;
    @Output() getDateChange = new EventEmitter<[string, string]>();
    // debouncer is used to emit values once in a time. Solves the problem with a lot of calls to db
    dateChangeDebouncer: Subject<[string, string]> = new Subject();
    @Output() typesChanged = new EventEmitter<Set<string>>();
    typesChangedDebouncer: Subject<Set<string>> = new Subject();
    // @Input() fromDate: Date;

    @ViewChild('graph') private chartElement: ElementRef;
    @ViewChild('plot_div') private plotElement: ElementRef;

    @Input()
    graphPanelOpenState = true;

    pickedFromDate = '1970-01-01T00:00:00';
    pickedToDate = '1970-01-01T00:00:00';
    saveGraphZoom = false;

    showAllTypes = false;
    supportedTypes: Set<string> = new Set<string>(['m', 'a', 'c', 'b']);
    selectedTypes: Set<string> = new Set<string>(['m', 'a', 'c', 'b']);

    loadingMTimes = false;
    loadingATimes = false;
    loadingCTimes = false;
    loadingBTimes = false;
    loadingAllTimes = false;

    min_date_boundary = null;
    max_date_boundary = null;

    mTypeColor = '#FF7F0E';
    aTypeColor = '#D62728';
    cTypeColor = '#2CA02C';
    bTypeColor = '#976CBF';
    allTypeColor = '#150abf';

    @ViewChild('chartOverviewDiv') chartOverviewDiv: ElementRef;
    chartOverview: Highcharts.ChartObject;
    chartOverviewOptions = {
        chart: {
            borderWidth: 0,
            backgroundColor: null,
            type: 'column',
            zoomType: 'x',
            animation: false,
            events: {
                selection: (event) => {
                    console.log(this.chartOverview.xAxis[0]);
                    let min = 0, max = 0;
                    if (event['resetSelection']) {
                        console.log('reset', event, this);
                        min = event.target['axes'][0].dataMin;
                        max = event.target['axes'][0].dataMax;
                    } else {
                        console.log(event);
                        min = event.xAxis[0].min;
                        max = event.xAxis[0].max;
                    }
                    this.graphZoom(new Date(min).toISOString(), new Date(max).toISOString());
                    this.chart.xAxis[0].setExtremes(min, max);
                    this.graphOverviewZoomLabel(min, max);
                    return false;

                },
                redraw: (event) => {
                    this.graphOverviewZoomLabel(new Date(this.pickedFromDate).getTime(), new Date(this.pickedToDate).getTime());
                }
            }
        },
        boost: {
            enabled: true,
            // useGPUTranslations: true,
            seriesThreshold: 1
        },
        title: {text: null, margin: 0},
        legend: {
            enabled: false
        },
        tooltip: {
            enabled: false
        },
        toolbar: {},
        xAxis: {
            type: 'datetime',
            dateTimeLabelFormats: {
                millisecond: '%H:%M:%S.%L',
                second: '%H:%M:%S',
                minute: '%H:%M',
                hour: '%H:%M',
                day: '%e. %b %Y',
                week: '%e. %b %Y',
                month: '%b %Y',
                year: '%Y'
            }
        },
        yAxis: {
            type: 'logarithmic',
            title: null,
            min: 1,
            softmax: 100000
        },
        plotOptions: {
            column: {
                stacking: 'normal',
                groupPadding: 0,
                pointPadding: 0,
                pointPlacement: 0.5,
                minPointLength: 3
            }
        },
        credits: {enabled: false},
        series: [
            {name: 'm', color: this.mTypeColor, boostThreshold: 10, data: []},
            {name: 'a', color: this.aTypeColor, boostThreshold: 10, data: []},
            {name: 'c', color: this.cTypeColor, boostThreshold: 10, data: []},
            {name: 'b', color: this.bTypeColor, boostThreshold: 10, data: []},
            {name: 'all', color: this.allTypeColor, visible: false, boostThreshold: 10, data: []}
        ]
    };

    @ViewChild('chartDiv') chartDiv: ElementRef;
    chart: Highcharts.ChartObject;
    chartOptions = {
        chart: {
            type: 'column',
            zoomType: 'x',
            animation: false,
            events: {
                selection: (event) => {
                    let min = 0, max = 0;
                    if (event['resetSelection']) {
                        console.log('reset', event, this);
                        min = event.target['axes'][0].dataMin;
                        max = event.target['axes'][0].dataMax;
                    } else {
                        console.log(event);
                        min = event.xAxis[0].min;
                        max = event.xAxis[0].max;
                    }
                    this.graphZoom(new Date(min).toISOString(), new Date(max).toISOString());
                    this.graphOverviewZoomLabel(min, max);
                }
            },
            resetZoomButton: {
                theme: {
                    display: 'None'
                }
            }
        },
        boost: {
            enabled: true,
            // useGPUTranslations: true,
            seriesThreshold: 1
        },
        title: {text: null, margin: 0},
        legend: {
            enabled: false
        },
        tooltip: {
            // outside: true,
            positioner: function(labelWidth, labelHeight, point) {
                return {
                    x: point.plotX,
                    y: this.plotHeight
                };
            }
        },
        toolbar: {},
        xAxis: {
            type: 'datetime',
            dateTimeLabelFormats: {
                millisecond: '%H:%M:%S.%L',
                second: '%H:%M:%S',
                minute: '%H:%M',
                hour: '%H:%M',
                day: '%e. %b %Y',
                week: '%e. %b %Y',
                month: '%b %Y',
                year: '%Y'
            }
        },
        yAxis: {
            type: 'logarithmic',
            title: null,
            min: 1
        },
        plotOptions: {
            column: {
                stacking: 'normal',
                groupPadding: 0,
                pointPadding: 0,
                pointPlacement: 0.5,
                minPointLength: 5
            }
        },
        credits: {enabled: false},
        series: [
            {name: 'm', color: this.mTypeColor, boostThreshold: 10, data: []},
            {name: 'a', color: this.aTypeColor, boostThreshold: 10, data: []},
            {name: 'c', color: this.cTypeColor, boostThreshold: 10, data: []},
            {name: 'b', color: this.bTypeColor, boostThreshold: 10, data: []},
            {name: 'all', color: this.allTypeColor, visible: false, boostThreshold: 10, data: []}
        ]
    };

    @ViewChild(D3HistogramComponent) d3Histogram: D3HistogramComponent;

    private subscriptions: Subscription[] = [];
    constructor(private graphService: GraphService) {
        // debouncer setup
        this.subscriptions.push(this.dateChangeDebouncer.pipe(debounceTime(100)).subscribe((value) => this.getDateChange.emit(value)));
        this.subscriptions.push(this.typesChangedDebouncer.pipe(debounceTime(100)).subscribe((value) => this.typesChanged.emit(value)));
    }

    ngOnInit() {
    }

    ngAfterViewInit() {
        this.chart = chart(this.chartDiv.nativeElement, this.chartOptions);
        this.chartOverview = chart(this.chartOverviewDiv.nativeElement, this.chartOverviewOptions);
    }

    ngOnDestroy() {
        this.subscriptions.forEach(subscription => subscription.unsubscribe());
    }

    /**
     * Graph initialization
     */
    init() {
        this.loadingMTimes = true;
        this.loadingATimes = true;
        this.loadingCTimes = true;
        this.loadingBTimes = true;
        this.loadingAllTimes = true;

        console.log('compute graph');
        this.graphService.getFirstAndLastTimestamp(this._case, this._clusters, null, null).then((res) => {
            console.log(res[0], res[1]);
            let first = new Date(res[0]);
            first = new Date(Date.UTC(first.getFullYear(), first.getMonth(), first.getDate()));
            console.log(first);
            this.min_date_boundary = first.getTime();
            let last = new Date(res[1]);
            console.log(last);
            last = new Date(Date.UTC(last.getFullYear(), last.getMonth(), last.getDate()));
            console.log(last);
            this.max_date_boundary = last.getTime() + (24 * 3600 * 1000);
            console.log(this.max_date_boundary);

            this.chart.xAxis[0].update({
                min: this.min_date_boundary,
                max: this.max_date_boundary
            });

            this.chartOverview.xAxis[0].update({
                min: this.min_date_boundary,
                max: this.max_date_boundary
            });

            if (!this.saveGraphZoom) {
                console.log('loaded', this.min_date_boundary, this.max_date_boundary);
                let isoString = new Date(this.min_date_boundary).toISOString();
                this.pickedFromDate = isoString.substring(0, isoString.length - 1);
                isoString = new Date(this.max_date_boundary).toISOString();
                this.pickedToDate = isoString.substring(0, isoString.length - 1);
            } else {
                const fromDate = new Date(this.pickedFromDate);
                const fromUTCDate = new Date(fromDate.getTime() - (fromDate.getTimezoneOffset() * 60000));
                const toDate = new Date(this.pickedToDate);
                const toUTCDate = new Date(toDate.getTime() - (fromDate.getTimezoneOffset() * 60000));
                if (new Date(fromUTCDate).getTime() === new Date(this.min_date_boundary).getTime() &&
                    new Date(toUTCDate).getTime() === new Date(this.max_date_boundary).getTime()) {
                    this.saveGraphZoom = false;
                }
            }
        });

        // Loading mactimes - modified
        this.graphService.getData(this._case, this._clusters, null, 'm', null)
            .then(response => {
                // this.graphPlot.data[0].x = response.x;
                // this.graphPlot.data[0].y = response.y;
                // const data = response.x.map(function (x, i) { return [new Date(x).getTime(), parseInt(response.y[i], 10)]; });

                // Making small values visible
                const data = response.x.map(function (x, i) {

                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                // this.charter.addSerie({name: 'm', color: this.mTypeColor, data: data});
                // this.chartOptions.series[0].data = data;
                // this.highCharts.series[0].data = data;
                this.chart.series[0].setData(data, false, false,  false);
                this.chartOverview.series[0].setData(data, false, false,  false);
                console.log('Graph data loaded async! - m', response);
                this.loadingMTimes = false;
                // this.d3Histogram.data[0] = {name: 'm', color: this.mTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
                // console.log(data);

            });

        // Loading mactimes - access
        this.graphService.getData(this._case, this._clusters, null, 'a', null)
            .then(response => {
                // this.graphPlot.data[1].x = response.x;
                // this.graphPlot.data[1].y = response.y;
                // const data = response.x.map(function (x, i) { return [new Date(x).getTime(), parseInt(response.y[i], 10)]; });

                // Making small values visible
                const data = response.x.map(function (x, i) {

                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                // this.charter.addSerie({name: 'a', color: this.aTypeColor, data: data});
                this.chart.series[1].setData(data, false, false,  false);
                this.chartOverview.series[1].setData(data, false, false,  false);
                console.log('Graph data loaded async! - a', response);
                this.loadingATimes = false;
                // this.d3Histogram.data[1] = {name: 'a', color: this.aTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - changed
        this.graphService.getData(this._case, this._clusters, null, 'c', null)
            .then(response => {
                // this.graphPlot.data[2].x = response.x;
                // this.graphPlot.data[2].y = response.y;
                // const data = response.x.map(function (x, i) { return [new Date(x).getTime(), parseInt(response.y[i], 10)]; });

                // Making small values visible
                const data = response.x.map(function (x, i) {

                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                // this.charter.addSerie({name: 'c', color: this.cTypeColor, data: data});
                this.chart.series[2].setData(data, false, false,  false);
                this.chartOverview.series[2].setData(data, false, false,  false);
                console.log('Graph data loaded async! - c', response);
                this.loadingCTimes = false;
                // this.d3Histogram.data[2] = {name: 'c', color: this.cTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - birth
        this.graphService.getData(this._case, this._clusters, null, 'b', null)
            .then(response => {
                // this.graphPlot.data[3].x = response.x;
                // this.graphPlot.data[3].y = response.y;
                // const data = response.x.map(function (x, i) { return [new Date(x).getTime(), parseInt(response.y[i], 10)]; });

                // Making small values visible
                const data = response.x.map(function (x, i) {

                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                // this.charter.addSerie({name: 'b', color: this.bTypeColor, data: data});
                this.chart.series[3].setData(data, false, false,  false);
                this.chartOverview.series[3].setData(data, false, false,  false);
                console.log('Graph data loaded async! - b', response);

                this.loadingBTimes = false;
                // this.d3Histogram.data[3] = {name: 'b', color: this.bTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Load counts of all timestamps
        this.graphService.getData(this._case, this._clusters, null, null, null)
            .then(response => {
                // this.graphPlot.data[3].x = response.x;
                // this.graphPlot.data[3].y = response.y;
                // const data = response.x.map(function (x, i) { return [new Date(x).getTime(), parseInt(response.y[i], 10)]; });

                // Making small values visible
                const data = response.x.map(function (x, i) {

                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                // this.charter.addSerie({name: 'b', color: this.bTypeColor, data: data});
                this.chart.series[4].setData(data, false, false,  false);
                // this.chartOverview.series[4].setData(data, false, false,  false);
                console.log('Graph data loaded async! - all', response);

                this.loadingAllTimes = false;
                this.chartDataLoaded();
            });

    }

    chartDataLoaded() {
        if (!this.loadingMTimes && !this.loadingATimes && !this.loadingCTimes && !this.loadingBTimes) {
            this.chart.redraw(false);
            this.chartOverview.redraw(false);
            // this.d3Histogram.createChart();
        }
    }

    graphZoom(x1, x2) {
        console.log('graph zooming', x1, x2);
        this.dateChangeDebouncer.next([x1, x2]);
        let isoString = new Date(x1).toISOString();
        this.pickedFromDate = isoString.substring(0, isoString.length - 5);
        isoString = new Date(x2).toISOString();
        this.pickedToDate = isoString.substring(0, isoString.length - 5);
        this.saveGraphZoom = true;
    }

    graphOverviewZoomLabel(from: number, to: number) {
        this.chartOverview.xAxis[0].removePlotBand('mask-before');
        this.chartOverview.xAxis[0].addPlotBand({
            id: 'mask-before',
            from: this.min_date_boundary,
            to: from,
            color: 'rgba(30, 30, 30, 0.4)'
        });
        this.chartOverview.xAxis[0].removePlotBand('mask-after');
        this.chartOverview.xAxis[0].addPlotBand({
            id: 'mask-after',
            from: to,
            to: this.max_date_boundary,
            color: 'rgba(30, 30, 30, 0.4)'
        });
        this.chartOverview.xAxis[0].removePlotLine('start');
        this.chartOverview.xAxis[0].addPlotLine({
            id: 'start',
            value: from,
            color: 'rgba(250, 250, 250, 0.4)',
            width: 1,
            zIndex: 8
        });
        this.chartOverview.xAxis[0].removePlotLine('end');
        this.chartOverview.xAxis[0].addPlotLine({
            id: 'end',
            value: to,
            color: 'rgba(250, 250, 250, 0.4)',
            width: 1,
            zIndex: 8
        });
    }

    drawGraphSliderWindow(from: number, to: number) {
        let from_edit = new Date(from);
        from_edit = new Date(Date.UTC(from_edit.getFullYear(), from_edit.getMonth(), from_edit.getDate()));
        let to_edit = new Date(to);
        to_edit = new Date(Date.UTC(to_edit.getFullYear(), to_edit.getMonth(), to_edit.getDate()));
        this.chart.xAxis[0].removePlotBand('range');
        this.chart.xAxis[0].addPlotBand({
            id: 'range',
            from: from_edit.getTime(),
            to: to_edit.getTime() + (24 * 3600 * 1000),
            color: 'rgba(173, 216, 230, 0.4)',
	    // color: 'rgba(245, 245, 220, 0.4)',
            // borderColor: 'rgba(30, 30, 30, 0.8)',
            // borderWidth: 1,
            label: {
                text: '<span style="position: relative; top: -16px;">view position</span>',
                useHTML: true
            }
        });
        // this.chart.xAxis[0].removePlotLine('box-start');
        // this.chart.xAxis[0].addPlotLine({
        //     id: 'box-start',
        //     value: from,
        //     color: 'rgba(30, 30, 30, 0.4)',
        //     dashStyle: 'LongDash',
        //     width: 1,
        //     zIndex: 8
        // });
        // this.chart.xAxis[0].removePlotLine('end');
        // this.chart.xAxis[0].addPlotLine({
        //     id: 'box-end',
        //     value: to,
        //     color: 'rgba(30, 30, 30, 0.4)',
        //     dashStyle: 'LongDash',
        //     width: 1,
        //     zIndex: 8
        // });
    }

    updateBoundary() {
        const fromUTCDateTime = new Date(this.pickedFromDate).getTime() - new Date(this.pickedFromDate).getTimezoneOffset() * 60000;
        const toUTCDateTime = new Date(this.pickedToDate).getTime() - new Date(this.pickedToDate).getTimezoneOffset() * 60000;
        this.saveGraphZoom = true;
        this.chart.xAxis[0].setExtremes(fromUTCDateTime, toUTCDateTime);
        this.graphOverviewZoomLabel(fromUTCDateTime, toUTCDateTime);
        // this.chart.showResetZoom();
        // console.log(this.pickedFromDate);
        this.dateChangeDebouncer.next([
            new Date(fromUTCDateTime).toISOString(),
            new Date(toUTCDateTime).toISOString()
        ]);
    }

    collapseGraphPanel() {
        this.graphPanelOpenState = !this.graphPanelOpenState;
    }

    showHideTrace(metadataType) {
        for (let i = 0; i < this.chart.series.length; i++) {
            if (this.chart.series[i].name === metadataType) {
                if (this.chart.series[i].visible) {
                    this.chart.series[i].hide();
                    this.chartOverview.series[i].hide();
                } else {
                    this.chart.series[i].show();
                    this.chartOverview.series[i].show();
                }
            }
        }
    }

    showSelectedTraces() {
        for (let i = 0; i < this.chart.series.length; i++) {
            if (this.selectedTypes.has(this.chart.series[i].name)) {
                this.chart.series[i].show();
                this.chartOverview.series[i].show();
            } else {
                this.chart.series[i].hide();
                this.chartOverview.series[i].hide();
            }
        }
    }

    typeCheckboxChanged(type) {
        if (this.supportedTypes.has(type)) {
            if (this.selectedTypes.has(type)) {
                this.selectedTypes.delete(type);
            } else {
                this.selectedTypes.add(type);
            }
            this.showHideTrace(type);
            // this.typesChanged.emit(this.selectedTypes);
            this.d3Histogram.showAndHideTraces(Array.from(this.selectedTypes));
            this.typesChangedDebouncer.next(this.selectedTypes);
            console.log('selected metadata types changed', this.selectedTypes);
        }
    }

    getCheckboxColor(type) {
        switch (type) {
            case 'm':
                return this.mTypeColor;
            case 'a':
                return this.aTypeColor;
            case 'c':
                return this.cTypeColor;
            case 'b':
                return this.bTypeColor;
            case 'all':
                return this.allTypeColor;
        }
        return '#FF5500';
    }

    resetZoom() {
        this.saveGraphZoom = false;
        // reset charts zoom
        this.chart.xAxis[0].setExtremes(null, null);
        this.chartOverview.xAxis[0].setExtremes(null, null);
        // reset date Inputs
        let isoString = new Date(this.min_date_boundary).toISOString();
        this.pickedFromDate = isoString.substring(0, isoString.length - 1);
        isoString = new Date(this.max_date_boundary).toISOString();
        this.pickedToDate = isoString.substring(0, isoString.length - 1);
        this.graphOverviewZoomLabel(new Date(this.min_date_boundary).getTime(), new Date(this.max_date_boundary).getTime());
        this.dateChangeDebouncer.next([
            this.pickedFromDate.replace('T', ' '),
            this.pickedToDate.replace('T', ' ')]);
    }

    typeTooltip(type) {
        switch (type) {
            case 'm':
                return 'Modification type of metadata time describes time of last change of file content';
            case 'a':
                return 'Access type of metadata time describes time of last access to file';
            case 'c':
                return 'Change type of metadata time describes time of last change of file metadata but not its content';
            case 'b':
                return 'Birth type of metadata time describes creation time of file';
            case 'all':
                return 'All types';
        }
        return 'unknown type';
    }

    allTypesTrigger() {
        if (this.showAllTypes) {
            for (let i = 0; i < this.chart.series.length; i++) {
                console.log(this.chart.series[i].name);
                if (this.chart.series[i].name === 'all') {
                    console.log('triggered');
                    this.chart.series[i].show();
                    this.chartOverview.series[i].show();
                } else {
                    this.chart.series[i].hide();
                    this.chartOverview.series[i].hide();
                }
            }
            this.typesChangedDebouncer.next(this.supportedTypes);
        } else {
            this.showSelectedTraces();
            this.typesChangedDebouncer.next(this.selectedTypes);
        }
    }

    /**
     * Method to support drag and drop timestamps
     * @param $event Drag event
     */
    dragOver($event) {
        $event.preventDefault();
    }

    /**
     * Method to support drag and drop timestamps
     * @param $event
     * @param {string} dateModel Target date model (pickedFromDate x pickedToDate)
     */
    dropFilter($event, dateModel: string) {
        console.log('dropped', $event, $event.dataTransfer.getData('timestamp'));
        $event.preventDefault();
        const timestamp = JSON.parse($event.dataTransfer.getData('timestamp'));
        return new Date(timestamp).toISOString().slice(0, -1);
    }

    /**
     * Sets given date as "From" boundary
     * @param {Date} date Date
     */
    setFromBoundary(date: Date) {
        this.pickedFromDate = date.toISOString().split('.')[0];
        this.updateBoundary();
    }

    /**
     * Sets given date as "To" boundary
     * @param {Date} date Date
     */
    setToBoundary(date: Date) {
        this.pickedToDate = date.toISOString().split('.')[0];
        this.updateBoundary();
    }

    transformSelectionsToFilter(selections) {
        console.log(selections);
        if (selections.length > 0) {
            const fromUTCDateTime = new Date(selections[0][0]).getTime() - new Date(selections[0][0]).getTimezoneOffset() * 60000;
            const toUTCDateTime = new Date(selections[0][1]).getTime() - new Date(selections[0][1]).getTimezoneOffset() * 60000;
            this.saveGraphZoom = true;
            this.chart.xAxis[0].setExtremes(fromUTCDateTime, toUTCDateTime);
            this.graphOverviewZoomLabel(fromUTCDateTime, toUTCDateTime);
            // this.chart.showResetZoom();
            // console.log(this.pickedFromDate);
            this.dateChangeDebouncer.next([
                new Date(fromUTCDateTime).toISOString(),
                new Date(toUTCDateTime).toISOString()
            ]);
        } else {
            const fromUTCDateTime = new Date(this.min_date_boundary).getTime() - new Date(this.min_date_boundary).getTimezoneOffset() * 60000;
            const toUTCDateTime = new Date(this.max_date_boundary).getTime() - new Date(this.max_date_boundary).getTimezoneOffset() * 60000;
            this.saveGraphZoom = false;
            this.chart.xAxis[0].setExtremes(fromUTCDateTime, toUTCDateTime);
            this.graphOverviewZoomLabel(fromUTCDateTime, toUTCDateTime);
            // this.chart.showResetZoom();
            // console.log(this.pickedFromDate);
            this.dateChangeDebouncer.next([
                new Date(fromUTCDateTime).toISOString(),
                new Date(toUTCDateTime).toISOString()
            ]);
        }
    }
}
