import {Component, OnInit, Input, ViewChild, ElementRef, Output, EventEmitter, AfterViewInit, OnDestroy} from '@angular/core';
import {ClusterModel} from '../../models/cluster.model';
import {Subject, Subscription} from 'rxjs';
import {debounceTime} from 'rxjs/operators';
import { chart } from 'highcharts';
import * as Highcharts from 'highcharts';
import {GraphService} from '../../services/graph.service';
import {VirtualScrollerComponent} from 'ngx-virtual-scroller';
import {D3HistogramComponent} from './d3Histogram/d3Histogram.component';
import * as d3 from 'd3';
import {Hotkey, HotkeysService} from 'angular2-hotkeys';
import {StateService} from '../../services/state.service';
import {LoadingStatus} from './loading-status';

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
    @Output() getDateChange = new EventEmitter<Array<[string, string]>>();
    // debouncer is used to emit values once in a time. Solves the problem with a lot of calls to db
    dateChangeDebouncer: Subject<Array<[string, string]>> = new Subject();
    @Output() typesChanged = new EventEmitter<Set<string>>();
    typesChangedDebouncer: Subject<Set<string>> = new Subject();
    // @Input() fromDate: Date;
    @Output() scrollToBar = new EventEmitter<Date>();
    @Output() scrollToMarkById = new EventEmitter<Number>();

    @ViewChild('graph', {static: false}) private chartElement: ElementRef;
    @ViewChild('plot_div', {static: false}) private plotElement: ElementRef;

    additionalFilters;

    @Input()
    graphPanelOpenState = true;

    pickedFromDate = '1970-01-01T00:00:00';
    pickedToDate = '1970-01-01T00:00:00';
    saveGraphZoom = false;

    showAllTypes = false;
    supportedTypes: Set<string> = new Set<string>(['m', 'a', 'c', 'b']);
    selectedTypes: Set<string> = new Set<string>(['m', 'a', 'c', 'b']);

    monthsLoadingStatus = new LoadingStatus();
    weeksLoadingStatus = new LoadingStatus();
    daysLoadingStatus = new LoadingStatus();
    hoursLoadingStatus = new LoadingStatus();

    min_date_boundary = null;
    max_date_boundary = null;

    mTypeColor = '#FF7F0E';
    aTypeColor = '#D62728';
    cTypeColor = '#2CA02C';
    bTypeColor = '#976CBF';
    allTypeColor = '#150abf';

    // @ViewChild('chartOverviewDiv') chartOverviewDiv: ElementRef;
    // chartOverview: Highcharts.ChartObject;
    // chartOverviewOptions = {
    //     chart: {
    //         borderWidth: 0,
    //         backgroundColor: null,
    //         type: 'column',
    //         zoomType: 'x',
    //         animation: false,
    //         events: {
    //             selection: (event) => {
    //                 console.log(this.chartOverview.xAxis[0]);
    //                 let min = 0, max = 0;
    //                 if (event['resetSelection']) {
    //                     console.log('reset', event, this);
    //                     min = event.target['axes'][0].dataMin;
    //                     max = event.target['axes'][0].dataMax;
    //                 } else {
    //                     console.log(event);
    //                     min = event.xAxis[0].min;
    //                     max = event.xAxis[0].max;
    //                 }
    //                 this.graphZoom(new Date(min).toISOString(), new Date(max).toISOString());
    //                 this.chart.xAxis[0].setExtremes(min, max);
    //                 this.graphOverviewZoomLabel(min, max);
    //                 return false;
    //
    //             },
    //             redraw: (event) => {
    //                 this.graphOverviewZoomLabel(new Date(this.pickedFromDate).getTime(), new Date(this.pickedToDate).getTime());
    //             }
    //         }
    //     },
    //     boost: {
    //         enabled: true,
    //         // useGPUTranslations: true,
    //         seriesThreshold: 1
    //     },
    //     title: {text: null, margin: 0},
    //     legend: {
    //         enabled: false
    //     },
    //     tooltip: {
    //         enabled: false
    //     },
    //     toolbar: {},
    //     xAxis: {
    //         type: 'datetime',
    //         dateTimeLabelFormats: {
    //             millisecond: '%H:%M:%S.%L',
    //             second: '%H:%M:%S',
    //             minute: '%H:%M',
    //             hour: '%H:%M',
    //             day: '%e. %b %Y',
    //             week: '%e. %b %Y',
    //             month: '%b %Y',
    //             year: '%Y'
    //         }
    //     },
    //     yAxis: {
    //         type: 'logarithmic',
    //         title: null,
    //         min: 1,
    //         softmax: 100000
    //     },
    //     plotOptions: {
    //         column: {
    //             stacking: 'normal',
    //             groupPadding: 0,
    //             pointPadding: 0,
    //             pointPlacement: 0.5,
    //             minPointLength: 3
    //         }
    //     },
    //     credits: {enabled: false},
    //     series: [
    //         {name: 'm', color: this.mTypeColor, boostThreshold: 10, data: []},
    //         {name: 'a', color: this.aTypeColor, boostThreshold: 10, data: []},
    //         {name: 'c', color: this.cTypeColor, boostThreshold: 10, data: []},
    //         {name: 'b', color: this.bTypeColor, boostThreshold: 10, data: []},
    //         {name: 'all', color: this.allTypeColor, visible: false, boostThreshold: 10, data: []}
    //     ]
    // };
    //
    // @ViewChild('chartDiv') chartDiv: ElementRef;
    // chart: Highcharts.ChartObject;
    // chartOptions = {
    //     chart: {
    //         type: 'column',
    //         zoomType: 'x',
    //         animation: false,
    //         events: {
    //             selection: (event) => {
    //                 let min = 0, max = 0;
    //                 if (event['resetSelection']) {
    //                     console.log('reset', event, this);
    //                     min = event.target['axes'][0].dataMin;
    //                     max = event.target['axes'][0].dataMax;
    //                 } else {
    //                     console.log(event);
    //                     min = event.xAxis[0].min;
    //                     max = event.xAxis[0].max;
    //                 }
    //                 this.graphZoom(new Date(min).toISOString(), new Date(max).toISOString());
    //                 this.graphOverviewZoomLabel(min, max);
    //             }
    //         },
    //         resetZoomButton: {
    //             theme: {
    //                 display: 'None'
    //             }
    //         }
    //     },
    //     boost: {
    //         enabled: true,
    //         // useGPUTranslations: true,
    //         seriesThreshold: 1
    //     },
    //     title: {text: null, margin: 0},
    //     legend: {
    //         enabled: false
    //     },
    //     tooltip: {
    //         // outside: true,
    //         positioner: function(labelWidth, labelHeight, point) {
    //             return {
    //                 x: point.plotX,
    //                 y: this.plotHeight
    //             };
    //         }
    //     },
    //     toolbar: {},
    //     xAxis: {
    //         type: 'datetime',
    //         dateTimeLabelFormats: {
    //             millisecond: '%H:%M:%S.%L',
    //             second: '%H:%M:%S',
    //             minute: '%H:%M',
    //             hour: '%H:%M',
    //             day: '%e. %b %Y',
    //             week: '%e. %b %Y',
    //             month: '%b %Y',
    //             year: '%Y'
    //         }
    //     },
    //     yAxis: {
    //         type: 'logarithmic',
    //         title: null,
    //         min: 1
    //     },
    //     plotOptions: {
    //         column: {
    //             stacking: 'normal',
    //             groupPadding: 0,
    //             pointPadding: 0,
    //             pointPlacement: 0.5,
    //             minPointLength: 5
    //         }
    //     },
    //     credits: {enabled: false},
    //     series: [
    //         {name: 'm', color: this.mTypeColor, boostThreshold: 10, data: []},
    //         {name: 'a', color: this.aTypeColor, boostThreshold: 10, data: []},
    //         {name: 'c', color: this.cTypeColor, boostThreshold: 10, data: []},
    //         {name: 'b', color: this.bTypeColor, boostThreshold: 10, data: []},
    //         {name: 'all', color: this.allTypeColor, visible: false, boostThreshold: 10, data: []}
    //     ]
    // };

    @ViewChild(D3HistogramComponent, {static: false}) d3Histogram: D3HistogramComponent;

    private subscriptions: Subscription[] = [];
    constructor(private graphService: GraphService,
                private _hotkeysService: HotkeysService,
                private stateService: StateService) {
        // debouncer setup
        this.subscriptions.push(this.dateChangeDebouncer.pipe(debounceTime(100)).subscribe((value) => this.getDateChange.emit(value)));
        this.subscriptions.push(this.typesChangedDebouncer.pipe(debounceTime(100)).subscribe((value) => this.typesChanged.emit(value)));
        this.subscriptions.push(this.stateService.currentStateClusters.subscribe((value) => this.setClusters(value)));
        this._hotkeysService.add(new Hotkey(['shift+m'], (event: KeyboardEvent): boolean => {
            // De/select m type switch button
            this.typeCheckboxChanged('m');
            return false; // Prevent bubbling
        }, undefined, 'De/select m type switch button'));
        this._hotkeysService.add(new Hotkey(['shift+a'], (event: KeyboardEvent): boolean => {
            // De/select a type switch button
            this.typeCheckboxChanged('a');
            return false; // Prevent bubbling
        }, undefined, 'De/select a type switch button'));
        this._hotkeysService.add(new Hotkey(['shift+c'], (event: KeyboardEvent): boolean => {
            // De/select c type switch button
            this.typeCheckboxChanged('c');
            return false; // Prevent bubbling
        }, undefined, 'De/select c type switch button'));
        this._hotkeysService.add(new Hotkey(['shift+b'], (event: KeyboardEvent): boolean => {
            // De/select b type switch button
            this.typeCheckboxChanged('b');
            return false; // Prevent bubbling
        }, undefined, 'De/select b type switch button'));
    }

    ngOnInit() {
    }

    ngAfterViewInit() {
        // this.chart = chart(this.chartDiv.nativeElement, this.chartOptions);
        // this.chartOverview = chart(this.chartOverviewDiv.nativeElement, this.chartOverviewOptions);
    }

    ngOnDestroy() {
        this.subscriptions.forEach(subscription => subscription.unsubscribe());
    }

    /**
     * Graph initialization
     */
    init() {
        this.setLoadingIndicatorsToTrue();

        // console.log('compute graph');
        this.graphService.getFirstAndLastTimestamp(this._case, this._clusters, null, null).then((res) => {
            if (res.length > 0) {
                let first = new Date(res[0]);
                first = new Date(Date.UTC(first.getFullYear(), first.getMonth(), first.getDate()));
                this.min_date_boundary = first.getTime();
                let last = new Date(res[1]);
                last = new Date(Date.UTC(last.getFullYear(), last.getMonth(), last.getDate()));
                this.max_date_boundary = last.getTime() + (24 * 3600 * 1000);

                // this.chart.xAxis[0].update({
                //     min: this.min_date_boundary,
                //     max: this.max_date_boundary
                // });
                //
                // this.chartOverview.xAxis[0].update({
                //     min: this.min_date_boundary,
                //     max: this.max_date_boundary
                // });

                if (!this.saveGraphZoom) {
                    // console.log('loaded', this.min_date_boundary, this.max_date_boundary);
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
            }
        });


        // // Loading mactimes - modified
        // this.graphService.getData(this._case, this._clusters, null, 'm', 'day')
        //     .then(response => {
        //         // this.graphPlot.data[0].x = response.x;
        //         // this.graphPlot.data[0].y = response.y;
        //         // const data = response.x.map(function (x, i) { return [new Date(x).getTime(), parseInt(response.y[i], 10)]; });
        //
        //         // Making small values visible
        //         const data = response.x.map(function (x, i) {
        //
        //             if (parseInt(response.y[i], 10) === 0) {
        //                 return [new Date(x).getTime(), null];
        //             } else {
        //                 return [new Date(x).getTime(), parseInt(response.y[i], 10)];
        //             }
        //         });
        //
        //         // this.charter.addSerie({name: 'm', color: this.mTypeColor, data: data});
        //         // this.chartOptions.series[0].data = data;
        //         // this.highCharts.series[0].data = data;
        //         // this.chart.series[0].setData(data, false, false,  false);
        //         // this.chartOverview.series[0].setData(data, false, false,  false);
        //         // console.log('Graph data loaded async! - m', response);
        //         this.loadingMTimes = false;
        //         this.d3Histogram.data_days[0] = {name: 'm', color: this.mTypeColor, data: data, maxValue: 0};
        //         this.chartDataLoaded();
        //         // console.log(data);
        //
        //     });

        this.loadGraphMonthData();
        this.loadGraphWeekData();
        this.loadGraphDayData();
        this.loadGraphHourData();

        // // Loading mactimes - access
        // this.graphService.getData(this._case, this._clusters, null, 'a', 'day')
        //     .then(response => {
        //         // this.graphPlot.data[1].x = response.x;
        //         // this.graphPlot.data[1].y = response.y;
        //         // const data = response.x.map(function (x, i) { return [new Date(x).getTime(), parseInt(response.y[i], 10)]; });
        //
        //         // Making small values visible
        //         const data = response.x.map(function (x, i) {
        //
        //             if (parseInt(response.y[i], 10) === 0) {
        //                 return [new Date(x).getTime(), null];
        //             } else {
        //                 return [new Date(x).getTime(), parseInt(response.y[i], 10)];
        //             }
        //         });
        //
        //         // this.charter.addSerie({name: 'a', color: this.aTypeColor, data: data});
        //         // this.chart.series[1].setData(data, false, false,  false);
        //         // this.chartOverview.series[1].setData(data, false, false,  false);
        //         // console.log('Graph data loaded async! - a', response);
        //         this.loadingATimes = false;
        //         this.d3Histogram.data_days[1] = {name: 'a', color: this.aTypeColor, data: data, maxValue: 0};
        //         this.chartDataLoaded();
        //     });
        //
        // // Loading mactimes - changed
        // this.graphService.getData(this._case, this._clusters, null, 'c', 'day')
        //     .then(response => {
        //         // this.graphPlot.data[2].x = response.x;
        //         // this.graphPlot.data[2].y = response.y;
        //         // const data = response.x.map(function (x, i) { return [new Date(x).getTime(), parseInt(response.y[i], 10)]; });
        //
        //         // Making small values visible
        //         const data = response.x.map(function (x, i) {
        //
        //             if (parseInt(response.y[i], 10) === 0) {
        //                 return [new Date(x).getTime(), null];
        //             } else {
        //                 return [new Date(x).getTime(), parseInt(response.y[i], 10)];
        //             }
        //         });
        //
        //         // this.charter.addSerie({name: 'c', color: this.cTypeColor, data: data});
        //         // this.chart.series[2].setData(data, false, false,  false);
        //         // this.chartOverview.series[2].setData(data, false, false,  false);
        //         // console.log('Graph data loaded async! - c', response);
        //         this.loadingCTimes = false;
        //         this.d3Histogram.data_days[2] = {name: 'c', color: this.cTypeColor, data: data, maxValue: 0};
        //         this.chartDataLoaded();
        //     });
        //
        // // Loading mactimes - birth
        // this.graphService.getData(this._case, this._clusters, null, 'b', 'day')
        //     .then(response => {
        //         // this.graphPlot.data[3].x = response.x;
        //         // this.graphPlot.data[3].y = response.y;
        //         // const data = response.x.map(function (x, i) { return [new Date(x).getTime(), parseInt(response.y[i], 10)]; });
        //
        //         // Making small values visible
        //         const data = response.x.map(function (x, i) {
        //
        //             if (parseInt(response.y[i], 10) === 0) {
        //                 return [new Date(x).getTime(), null];
        //             } else {
        //                 return [new Date(x).getTime(), parseInt(response.y[i], 10)];
        //             }
        //         });
        //
        //         // this.charter.addSerie({name: 'b', color: this.bTypeColor, data: data});
        //         // this.chart.series[3].setData(data, false, false,  false);
        //         // this.chartOverview.series[3].setData(data, false, false,  false);
        //         // console.log('Graph data loaded async! - b', response);
        //
        //         this.loadingBTimes = false;
        //         this.d3Histogram.data_days[3] = {name: 'b', color: this.bTypeColor, data: data, maxValue: 0};
        //         this.chartDataLoaded();
        //     });
        //
        // // Load counts of all timestamps
        // this.graphService.getData(this._case, this._clusters, null, null, null)
        //     .then(response => {
        //         // this.graphPlot.data[3].x = response.x;
        //         // this.graphPlot.data[3].y = response.y;
        //         // const data = response.x.map(function (x, i) { return [new Date(x).getTime(), parseInt(response.y[i], 10)]; });
        //
        //         // Making small values visible
        //         const data = response.x.map(function (x, i) {
        //
        //             if (parseInt(response.y[i], 10) === 0) {
        //                 return [new Date(x).getTime(), null];
        //             } else {
        //                 return [new Date(x).getTime(), parseInt(response.y[i], 10)];
        //             }
        //         });
        //
        //         // this.charter.addSerie({name: 'b', color: this.bTypeColor, data: data});
        //         // this.chart.series[4].setData(data, false, false,  false);
        //         // this.chartOverview.series[4].setData(data, false, false,  false);
        //         // console.log('Graph data loaded async! - all', response);
        //
        //         this.loadingAllTimes = false;
        //         // this.chartDataLoaded();
        //     });

        if (this.additionalFilters !== undefined) {
            this.loadFilteredData();
        }
        this.countPresenceOfMarksInCurrentCluster();
    }



    chartDataLoaded() {
        const relevantDataLoaded = this.areRelevantDataLoaded();

        if (relevantDataLoaded) {
            this.d3Histogram.createChart();
        }
    }

    graphZoom(x1, x2) {
        console.log('graph zooming', x1, x2);
        this.dateChangeDebouncer.next([[x1, x2]]);
        let isoString = new Date(x1).toISOString();
        this.pickedFromDate = isoString.substring(0, isoString.length - 5);
        isoString = new Date(x2).toISOString();
        this.pickedToDate = isoString.substring(0, isoString.length - 5);
        this.saveGraphZoom = true;
    }

    graphOverviewZoomLabel(from: number, to: number) {
        // this.chartOverview.xAxis[0].removePlotBand('mask-before');
        // this.chartOverview.xAxis[0].addPlotBand({
        //     id: 'mask-before',
        //     from: this.min_date_boundary,
        //     to: from,
        //     color: 'rgba(30, 30, 30, 0.4)'
        // });
        // this.chartOverview.xAxis[0].removePlotBand('mask-after');
        // this.chartOverview.xAxis[0].addPlotBand({
        //     id: 'mask-after',
        //     from: to,
        //     to: this.max_date_boundary,
        //     color: 'rgba(30, 30, 30, 0.4)'
        // });
        // this.chartOverview.xAxis[0].removePlotLine('start');
        // this.chartOverview.xAxis[0].addPlotLine({
        //     id: 'start',
        //     value: from,
        //     color: 'rgba(250, 250, 250, 0.4)',
        //     width: 1,
        //     zIndex: 8
        // });
        // this.chartOverview.xAxis[0].removePlotLine('end');
        // this.chartOverview.xAxis[0].addPlotLine({
        //     id: 'end',
        //     value: to,
        //     color: 'rgba(250, 250, 250, 0.4)',
        //     width: 1,
        //     zIndex: 8
        // });
    }

    drawGraphSliderWindow(from: number, to: number) {
        let from_edit = new Date(from);
        from_edit = new Date(Date.UTC(from_edit.getFullYear(), from_edit.getMonth(), from_edit.getDate()));
        let to_edit = new Date(to);
        to_edit = new Date(Date.UTC(to_edit.getFullYear(), to_edit.getMonth(), to_edit.getDate()));
        // this.chart.xAxis[0].removePlotBand('range');
        // this.chart.xAxis[0].addPlotBand({
        //     id: 'range',
        //     from: from_edit.getTime(),
        //     to: to_edit.getTime() + (24 * 3600 * 1000),
        //     color: 'rgba(173, 216, 230, 0.4)',
        // // color: 'rgba(245, 245, 220, 0.4)',
        //     // borderColor: 'rgba(30, 30, 30, 0.8)',
        //     // borderWidth: 1,
        //     label: {
        //         text: '<span style="position: relative; top: -16px;">view position</span>',
        //         useHTML: true
        //     }
        // });

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
        this.d3Histogram.updatePositionWindow(from_edit, to_edit);
    }

    updateBoundary() {
        const fromUTCDateTime = new Date(this.pickedFromDate).getTime() - new Date(this.pickedFromDate).getTimezoneOffset() * 60000;
        const toUTCDateTime = new Date(this.pickedToDate).getTime() - new Date(this.pickedToDate).getTimezoneOffset() * 60000;
        this.saveGraphZoom = true;
        // this.chart.xAxis[0].setExtremes(fromUTCDateTime, toUTCDateTime);
        this.graphOverviewZoomLabel(fromUTCDateTime, toUTCDateTime);
        // this.chart.showResetZoom();
        // console.log(this.pickedFromDate);
        this.dateChangeDebouncer.next([[
            new Date(fromUTCDateTime).toISOString(),
            new Date(toUTCDateTime).toISOString()
        ]]);
    }

    collapseGraphPanel() {
        this.graphPanelOpenState = !this.graphPanelOpenState;
    }

    showHideTrace(metadataType) {
        // for (let i = 0; i < this.chart.series.length; i++) {
        //     if (this.chart.series[i].name === metadataType) {
        //         if (this.chart.series[i].visible) {
        //             this.chart.series[i].hide();
        //             this.chartOverview.series[i].hide();
        //         } else {
        //             this.chart.series[i].show();
        //             this.chartOverview.series[i].show();
        //         }
        //     }
        // }
    }

    showSelectedTraces() {
        // for (let i = 0; i < this.chart.series.length; i++) {
        //     if (this.selectedTypes.has(this.chart.series[i].name)) {
        //         this.chart.series[i].show();
        //         this.chartOverview.series[i].show();
        //     } else {
        //         this.chart.series[i].hide();
        //         this.chartOverview.series[i].hide();
        //     }
        // }
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
            this.d3Histogram.selectedTypes = this.selectedTypes;
            this.d3Histogram.showAndHideTraces();
            this.typesChangedDebouncer.next(this.selectedTypes);
            // console.log('selected metadata types changed', this.selectedTypes);


            // if (this.selectedTypes.has('m')) {
            //     this.d3Histogram.mtimeVisible = true;
            // }
            // else {
            //
            // }
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
        // this.chart.xAxis[0].setExtremes(null, null);
        // this.chartOverview.xAxis[0].setExtremes(null, null);
        // reset date Inputs
        let isoString = new Date(this.min_date_boundary).toISOString();
        this.pickedFromDate = isoString.substring(0, isoString.length - 1);
        isoString = new Date(this.max_date_boundary).toISOString();
        this.pickedToDate = isoString.substring(0, isoString.length - 1);
        this.graphOverviewZoomLabel(new Date(this.min_date_boundary).getTime(), new Date(this.max_date_boundary).getTime());
        this.dateChangeDebouncer.next([[
            this.pickedFromDate.replace('T', ' '),
            this.pickedToDate.replace('T', ' ')]]);
    }

    typeTooltip(type) {
        switch (type) {
            case 'm':
                return 'When the file content was last changed';
            case 'a':
                return 'When the file was last accessed';
            case 'c':
                return 'When the file metadata was last changed';
            case 'b':
                return 'When the file was created';
            case 'all':
                return 'All types';
        }
        return 'unknown type';
    }

    allTypesTrigger() {
        if (this.showAllTypes) {
            // for (let i = 0; i < this.chart.series.length; i++) {
            //     console.log(this.chart.series[i].name);
            //     if (this.chart.series[i].name === 'all') {
            //         console.log('triggered');
            //         this.chart.series[i].show();
            //         this.chartOverview.series[i].show();
            //     } else {
            //         this.chart.series[i].hide();
            //         this.chartOverview.series[i].hide();
            //     }
            // }
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
        // console.log(selections);
        const allSelections: Array<[string, string]> = [];
        for (const sel of selections) {
            const fromUTCDateTime = new Date(sel[0]).getTime() - new Date(sel[0]).getTimezoneOffset() * 60000;
            const toUTCDateTime = new Date(sel[1]).getTime() - new Date(sel[1]).getTimezoneOffset() * 60000;
            allSelections.push([
                new Date(fromUTCDateTime).toISOString(),
                new Date(toUTCDateTime).toISOString()
            ]);
        }
        this.dateChangeDebouncer.next(allSelections);
    }

    getSelectedTypes() {
        return Array.from(this.selectedTypes);
    }

    // loadFilteredData() {
    //     if (this.additionalFilters !== undefined) {
    //         if (this.additionalFilters['searchString'] !== undefined) {
    //             this.loadingFilteredMTimes = true;
    //             this.loadingFilteredATimes = true;
    //             this.loadingFilteredCTimes = true;
    //             this.loadingFilteredBTimes = true;
    //
    //             this.graphService.getData(this._case, this._clusters, this.additionalFilters, 'm', null)
    //                 .then(response => {
    //                     // Making small values visible
    //                     const data = response.x.map(function (x, i) {
    //
    //                         if (parseInt(response.y[i], 10) === 0) {
    //                             return [new Date(x).getTime(), null];
    //                         } else {
    //                             return [new Date(x).getTime(), parseInt(response.y[i], 10)];
    //                         }
    //                     });
    //                     this.loadingFilteredMTimes = false;
    //                     this.d3Histogram.filteredData[0] = {name: 'm', color: this.mTypeColor, data: data, maxValue: 0};
    //                     this.chartDataLoaded();
    //                 });
    //
    //             // Loading mactimes - access
    //             this.graphService.getData(this._case, this._clusters, this.additionalFilters, 'a', null)
    //                 .then(response => {
    //                     // Making small values visible
    //                     const data = response.x.map(function (x, i) {
    //
    //                         if (parseInt(response.y[i], 10) === 0) {
    //                             return [new Date(x).getTime(), null];
    //                         } else {
    //                             return [new Date(x).getTime(), parseInt(response.y[i], 10)];
    //                         }
    //                     });
    //                     this.loadingFilteredATimes = false;
    //                     this.d3Histogram.filteredData[1] = {name: 'a', color: this.aTypeColor, data: data, maxValue: 0};
    //                     this.chartDataLoaded();
    //                 });
    //
    //             // Loading mactimes - changed
    //             this.graphService.getData(this._case, this._clusters, this.additionalFilters, 'c', null)
    //                 .then(response => {
    //                     // Making small values visible
    //                     const data = response.x.map(function (x, i) {
    //
    //                         if (parseInt(response.y[i], 10) === 0) {
    //                             return [new Date(x).getTime(), null];
    //                         } else {
    //                             return [new Date(x).getTime(), parseInt(response.y[i], 10)];
    //                         }
    //                     });
    //                     this.loadingFilteredCTimes = false;
    //                     this.d3Histogram.filteredData[2] = {name: 'c', color: this.cTypeColor, data: data, maxValue: 0};
    //                     this.chartDataLoaded();
    //                 });
    //
    //             // Loading mactimes - birth
    //             this.graphService.getData(this._case, this._clusters, this.additionalFilters, 'b', null)
    //                 .then(response => {
    //                     // Making small values visible
    //                     const data = response.x.map(function (x, i) {
    //
    //                         if (parseInt(response.y[i], 10) === 0) {
    //                             return [new Date(x).getTime(), null];
    //                         } else {
    //                             return [new Date(x).getTime(), parseInt(response.y[i], 10)];
    //                         }
    //                     });
    //                     this.loadingFilteredBTimes = false;
    //                     this.d3Histogram.filteredData[3] = {name: 'b', color: this.bTypeColor, data: data, maxValue: 0};
    //                     this.chartDataLoaded();
    //                 });
    //         } else {
    //             this.d3Histogram.filteredData = [];
    //             this.chartDataLoaded();
    //         }
    //     }
    // }

    loadFilteredData() {
        if (this.additionalFilters !== undefined) {
            if (this.additionalFilters['searchString'] !== undefined) {
                this.d3Histogram.searchString = this.additionalFilters['searchString'];
                this.setLoadingIndicatorsToTrueForFiltered();

                this.loadGraphFilteredMonthData();
                this.loadGraphFilteredWeekData();
                this.loadGraphFilteredDayData();
                this.loadGraphFilteredHourData();
            } else {
                this.d3Histogram.searchString = undefined;
                this.d3Histogram.filteredData = [];
                this.chartDataLoaded();
            }
        }
    }

    setClusters(clusters) {
        this._clusters = clusters;
        this.init();
    }

    async countPresenceOfMarksInCurrentCluster() {
        const marksInArray = Array.from(this.d3Histogram.marks.values());
        for (let i = 0; i < marksInArray.length; i++ ) {
            this.d3Histogram.marks.get(marksInArray[i].id).inCurrentCluster =
                await this.graphService.isMarkInCurrentCluster(this._case, this._clusters, marksInArray[i].id);
        }
        this.typesChangedDebouncer.next(this.selectedTypes);
       //this.d3Histogram.createChart();
    }

    loadGraphMonthData() {
        // Loading mactimes - modified
        this.graphService.getData(this._case, this._clusters, null, 'm', 'month')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.monthsLoadingStatus.mtimes = false;
                this.d3Histogram.data_months[0] = {name: 'm', color: this.mTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - access
        this.graphService.getData(this._case, this._clusters, null, 'a', 'month')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.monthsLoadingStatus.atimes = false;
                this.d3Histogram.data_months[1] = {name: 'a', color: this.aTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - changed
        this.graphService.getData(this._case, this._clusters, null, 'c', 'month')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.monthsLoadingStatus.ctimes = false;
                this.d3Histogram.data_months[2] = {name: 'c', color: this.cTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - birth
        this.graphService.getData(this._case, this._clusters, null, 'b', 'month')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.monthsLoadingStatus.btimes = false;
                this.d3Histogram.data_months[3] = {name: 'b', color: this.bTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

    }

    loadGraphWeekData() {
        // Loading mactimes - modified
        this.graphService.getData(this._case, this._clusters, null, 'm', 'week')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.weeksLoadingStatus.mtimes = false;
                this.d3Histogram.data_weeks[0] = {name: 'm', color: this.mTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - access
        this.graphService.getData(this._case, this._clusters, null, 'a', 'week')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.weeksLoadingStatus.atimes = false;
                this.d3Histogram.data_weeks[1] = {name: 'a', color: this.aTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - changed
        this.graphService.getData(this._case, this._clusters, null, 'c', 'week')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.weeksLoadingStatus.ctimes = false;
                this.d3Histogram.data_weeks[2] = {name: 'c', color: this.cTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - birth
        this.graphService.getData(this._case, this._clusters, null, 'b', 'week')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {

                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.weeksLoadingStatus.btimes = false;
                this.d3Histogram.data_weeks[3] = {name: 'b', color: this.bTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

    }

    loadGraphDayData() {
        // Loading mactimes - modified
        this.graphService.getData(this._case, this._clusters, null, 'm', 'day')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.daysLoadingStatus.mtimes = false;
                this.d3Histogram.data_days[0] = {name: 'm', color: this.mTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - access
        this.graphService.getData(this._case, this._clusters, null, 'a', 'day')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.daysLoadingStatus.atimes = false;
                this.d3Histogram.data_days[1] = {name: 'a', color: this.aTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - changed
        this.graphService.getData(this._case, this._clusters, null, 'c', 'day')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {

                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.daysLoadingStatus.ctimes = false;
                this.d3Histogram.data_days[2] = {name: 'c', color: this.cTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - birth
        this.graphService.getData(this._case, this._clusters, null, 'b', 'day')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.daysLoadingStatus.btimes = false;
                this.d3Histogram.data_days[3] = {name: 'b', color: this.bTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

    }

    loadGraphHourData() {
        // Loading mactimes - modified
        this.graphService.getData(this._case, this._clusters, null, 'm', 'hour')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.hoursLoadingStatus.mtimes = false;
                this.d3Histogram.data_hours[0] = {name: 'm', color: this.mTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - access
        this.graphService.getData(this._case, this._clusters, null, 'a', 'hour')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.hoursLoadingStatus.atimes = false;
                this.d3Histogram.data_hours[1] = {name: 'a', color: this.aTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - changed
        this.graphService.getData(this._case, this._clusters, null, 'c', 'hour')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.hoursLoadingStatus.ctimes = false;
                this.d3Histogram.data_hours[2] = {name: 'c', color: this.cTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - birth
        this.graphService.getData(this._case, this._clusters, null, 'b', 'hour')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.hoursLoadingStatus.btimes = false;
                this.d3Histogram.data_hours[3] = {name: 'b', color: this.bTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

    }

    loadGraphFilteredMonthData() {
        // Loading mactimes - modified
        this.graphService.getData(this._case, this._clusters, this.additionalFilters, 'm', 'month')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.monthsLoadingStatus.mtimesFiltered = false;
                this.d3Histogram.filteredDataMonths[0] = {name: 'm', color: this.mTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - access
        this.graphService.getData(this._case, this._clusters, this.additionalFilters, 'a', 'month')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.monthsLoadingStatus.atimesFiltered = false;
                this.d3Histogram.filteredDataMonths[1] = {name: 'a', color: this.aTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - changed
        this.graphService.getData(this._case, this._clusters, this.additionalFilters, 'c', 'month')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.monthsLoadingStatus.ctimesFiltered = false;
                this.d3Histogram.filteredDataMonths[2] = {name: 'c', color: this.cTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - birth
        this.graphService.getData(this._case, this._clusters, this.additionalFilters, 'b', 'month')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.monthsLoadingStatus.btimesFiltered = false;
                this.d3Histogram.filteredDataMonths[3] = {name: 'b', color: this.bTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

    }

    loadGraphFilteredWeekData() {
        // Loading mactimes - modified
        this.graphService.getData(this._case, this._clusters, this.additionalFilters, 'm', 'week')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.weeksLoadingStatus.mtimesFiltered = false;
                this.d3Histogram.filteredDataWeeks[0] = {name: 'm', color: this.mTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - access
        this.graphService.getData(this._case, this._clusters, this.additionalFilters, 'a', 'week')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.weeksLoadingStatus.atimesFiltered = false;
                this.d3Histogram.filteredDataWeeks[1] = {name: 'a', color: this.aTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - changed
        this.graphService.getData(this._case, this._clusters, this.additionalFilters, 'c', 'week')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.weeksLoadingStatus.ctimesFiltered = false;
                this.d3Histogram.filteredDataWeeks[2] = {name: 'c', color: this.cTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - birth
        this.graphService.getData(this._case, this._clusters, this.additionalFilters, 'b', 'week')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.weeksLoadingStatus.btimesFiltered = false;
                this.d3Histogram.filteredDataWeeks[3] = {name: 'b', color: this.bTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

    }

    loadGraphFilteredDayData() {
        // Loading mactimes - modified
        this.graphService.getData(this._case, this._clusters, this.additionalFilters, 'm', 'day')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.daysLoadingStatus.mtimesFiltered = false;
                this.d3Histogram.filteredDataDays[0] = {name: 'm', color: this.mTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - access
        this.graphService.getData(this._case, this._clusters, this.additionalFilters, 'a', 'day')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.daysLoadingStatus.atimesFiltered = false;
                this.d3Histogram.filteredDataDays[1] = {name: 'a', color: this.aTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - changed
        this.graphService.getData(this._case, this._clusters, this.additionalFilters, 'c', 'day')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {

                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.daysLoadingStatus.ctimesFiltered = false;
                this.d3Histogram.filteredDataDays[2] = {name: 'c', color: this.cTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - birth
        this.graphService.getData(this._case, this._clusters, this.additionalFilters, 'b', 'day')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.daysLoadingStatus.btimesFiltered = false;
                this.d3Histogram.filteredDataDays[3] = {name: 'b', color: this.bTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

    }

    loadGraphFilteredHourData() {
        // Loading mactimes - modified
        this.graphService.getData(this._case, this._clusters, this.additionalFilters, 'm', 'hour')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.hoursLoadingStatus.mtimesFiltered = false;
                this.d3Histogram.filteredDataHours[0] = {name: 'm', color: this.mTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - access
        this.graphService.getData(this._case, this._clusters, this.additionalFilters, 'a', 'hour')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.hoursLoadingStatus.atimesFiltered = false;
                this.d3Histogram.filteredDataHours[1] = {name: 'a', color: this.aTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - changed
        this.graphService.getData(this._case, this._clusters, this.additionalFilters, 'c', 'hour')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.hoursLoadingStatus.ctimesFiltered = false;
                this.d3Histogram.filteredDataHours[2] = {name: 'c', color: this.cTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

        // Loading mactimes - birth
        this.graphService.getData(this._case, this._clusters, this.additionalFilters, 'b', 'hour')
            .then(response => {
                // Making small values visible
                const data = response.x.map(function (x, i) {
                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                this.hoursLoadingStatus.btimesFiltered = false;
                this.d3Histogram.filteredDataHours[3] = {name: 'b', color: this.bTypeColor, data: data, maxValue: 0};
                this.chartDataLoaded();
            });

    }

    setLoadingIndicatorsToTrue() {
        this.monthsLoadingStatus.mtimes = true;
        this.monthsLoadingStatus.atimes = true;
        this.monthsLoadingStatus.ctimes = true;
        this.monthsLoadingStatus.btimes = true;

        this.weeksLoadingStatus.mtimes = true;
        this.weeksLoadingStatus.atimes = true;
        this.weeksLoadingStatus.ctimes = true;
        this.weeksLoadingStatus.btimes = true;

        this.daysLoadingStatus.mtimes = true;
        this.daysLoadingStatus.atimes = true;
        this.daysLoadingStatus.ctimes = true;
        this.daysLoadingStatus.btimes = true;

        this.hoursLoadingStatus.mtimes = true;
        this.hoursLoadingStatus.atimes = true;
        this.hoursLoadingStatus.ctimes = true;
        this.hoursLoadingStatus.btimes = true;
    }

    setLoadingIndicatorsToTrueForFiltered() {
        this.monthsLoadingStatus.mtimesFiltered = true;
        this.monthsLoadingStatus.atimesFiltered = true;
        this.monthsLoadingStatus.ctimesFiltered = true;
        this.monthsLoadingStatus.btimesFiltered = true;

        this.weeksLoadingStatus.mtimesFiltered = true;
        this.weeksLoadingStatus.atimesFiltered = true;
        this.weeksLoadingStatus.ctimesFiltered = true;
        this.weeksLoadingStatus.btimesFiltered = true;

        this.daysLoadingStatus.mtimesFiltered = true;
        this.daysLoadingStatus.atimesFiltered = true;
        this.daysLoadingStatus.ctimesFiltered = true;
        this.daysLoadingStatus.btimesFiltered = true;

        this.hoursLoadingStatus.mtimesFiltered = true;
        this.hoursLoadingStatus.atimesFiltered = true;
        this.hoursLoadingStatus.ctimesFiltered = true;
        this.hoursLoadingStatus.btimesFiltered = true;
    }

    areRelevantDataLoaded() {
        if (this.d3Histogram === undefined) {
            return true;
        }
        let relevantLoadingStatus  = this.monthsLoadingStatus;

        switch (this.d3Histogram.granularity_level) {
            case 'month': {
                relevantLoadingStatus = this.monthsLoadingStatus;
                break;
            }
            case 'week': {
                relevantLoadingStatus = this.weeksLoadingStatus;
                break;
            }
            case 'day': {
                relevantLoadingStatus = this.daysLoadingStatus;
                break;
            }
            case 'hour': {
                relevantLoadingStatus = this.hoursLoadingStatus;
                break;
            }
            default: {
                relevantLoadingStatus = this.monthsLoadingStatus;
                break;
            }
        }

        let dataLoaded = true;
        for (const key in relevantLoadingStatus) {
            if (this.monthsLoadingStatus[key] === true) {
                dataLoaded = false;
                break;
            }
        }

        return dataLoaded;
    }

}
