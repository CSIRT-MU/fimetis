import {Component, OnInit, Input, ViewChild, ElementRef, Output, EventEmitter, AfterViewInit} from '@angular/core';
import {ElasticsearchService} from '../../elasticsearch.service';
import {GraphManager} from '../../businessLayer/graphManager';
import {ClusterModel} from '../../models/cluster.model';
import {Subject} from 'rxjs';
import {debounceTime} from 'rxjs/operators';
import { chart } from 'highcharts';
import * as Highcharts from 'highcharts';
import {matDatepickerAnimations} from '@angular/material';

@Component({
    selector: 'app-graph',
    templateUrl: './graph.component.html',
    styleUrls: ['./graph.component.css']
})
export class GraphComponent implements OnInit, AfterViewInit {

    @Input() _case: string;
    @Input() _filter: string;
    @Input() _clusters: ClusterModel[] = [];
    @Input() _frequency: string;
    @Output() getDateChange = new EventEmitter<[string, string]>();
    // debouncer is used to emit values once in a time. Solves the problem with a lot of calls to db
    dateChangeDebouncer: Subject<[string, string]> = new Subject();
    @Output() openStateChange = new EventEmitter<boolean>();
    @Output() typesChanged = new EventEmitter<Set<string>>();
    @Input() fromDate: Date;

    @ViewChild('graph') private chartElement: ElementRef;
    @ViewChild('plot_div') private plotElement: ElementRef;

    @Input()
    graphPanelOpenState = true;

    pickedFromDate = '1970-01-01T00:00:00';
    pickedToDate = '1970-01-01T00:00:00';
    saveGraphZoom = false;

    supportedTypes: Set<string> = new Set<string>(['m', 'a', 'c', 'b', 'all']);
    selectedTypes: Set<string> = new Set<string>(['m', 'a', 'c', 'b']);

    private data: any;
    private manager;

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
            reflow: false,
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
        toolbar: {},
        xAxis: {
            type: 'datetime'
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
                pointPlacement: 0.5
            }
        },
        credits: {enabled: false},
        series: [
            {name: 'm', color: this.mTypeColor, visible: true, boostThreshold: 1, data: []},
            {name: 'a', color: this.aTypeColor, visible: true, boostThreshold: 1, data: []},
            {name: 'c', color: this.cTypeColor, visible: true, boostThreshold: 1, data: []},
            {name: 'b', color: this.bTypeColor, visible: true, boostThreshold: 1, data: []},
            {name: 'all', color: this.allTypeColor, visible: true, boostThreshold: 10, data: []}
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
                },
                redraw: () => {
                    if (!this.saveGraphZoom) {
                        console.log('load', this.chart.xAxis[0].dataMin, this.chart.xAxis[0].dataMax);
                        let isoString = new Date(this.chart.xAxis[0].dataMin).toISOString();
                        this.pickedFromDate = isoString.substring(0, isoString.length - 1);
                        isoString = new Date(this.max_date_boundary).toISOString();
                        this.pickedToDate = isoString.substring(0, isoString.length - 1);
                    }
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
            minPointLength: 3
        },
        plotOptions: {
            column: {
                stacking: 'normal',
                groupPadding: 0,
                pointPadding: 0,
                pointPlacement: 0.5
            }
        },
        credits: {enabled: false},
        series: [
            {name: 'm', color: this.mTypeColor, visible: true, boostThreshold: 10, data: []},
            {name: 'a', color: this.aTypeColor, visible: true, boostThreshold: 10, data: []},
            {name: 'c', color: this.cTypeColor, visible: true, boostThreshold: 10, data: []},
            {name: 'b', color: this.bTypeColor, visible: true, boostThreshold: 10, data: []},
            {name: 'all', color: this.allTypeColor, visible: true, boostThreshold: 10, data: []}
        ]
    };

    constructor(private es: ElasticsearchService) {
        this.manager = new GraphManager(es);
        // debouncer setup
        this.dateChangeDebouncer.pipe(debounceTime(100)).subscribe((value) => this.getDateChange.emit(value));
        console.log(this.chartDiv);
    }


    ngOnInit() {
    }

    ngAfterViewInit() {
        this.chart = chart(this.chartDiv.nativeElement, this.chartOptions);
        this.chartOverview = chart(this.chartOverviewDiv.nativeElement, this.chartOverviewOptions);
    }


    /**
     * Graph initialization
     */
    init() {
        this.manager.case = this._case;
        // this.manager.filter = this._filter;
        this.manager.clusters = this._clusters;
        this.manager.frequency = this._frequency;

        this.loadingMTimes = true;
        this.loadingATimes = true;
        this.loadingCTimes = true;
        this.loadingBTimes = true;

        console.log('compute graph');
        // Loading mactimes - modified
        this.manager.getData('m')
            .then(response => {
                // this.graphPlot.data[0].x = response.x;
                // this.graphPlot.data[0].y = response.y;
                // const data = response.x.map(function (x, i) { return [new Date(x).getTime(), parseInt(response.y[i], 10)]; });

                // Making small values visible
                const data = response.x.map(function (x, i) {

                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null, 10];
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
                this.chartDataLoaded();
            });

        // Loading mactimes - access
        this.manager.getData('a')
            .then(response => {
                // this.graphPlot.data[1].x = response.x;
                // this.graphPlot.data[1].y = response.y;
                // const data = response.x.map(function (x, i) { return [new Date(x).getTime(), parseInt(response.y[i], 10)]; });

                // Making small values visible
                const data = response.x.map(function (x, i) {

                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null, 10];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                // this.charter.addSerie({name: 'a', color: this.aTypeColor, data: data});
                this.chart.series[1].setData(data, false, false,  false);
                this.chartOverview.series[1].setData(data, false, false,  false);
                console.log('Graph data loaded async! - a', response);
                this.loadingATimes = false;
                this.chartDataLoaded();
            });

        // Loading mactimes - changed
        this.manager.getData('c')
            .then(response => {
                // this.graphPlot.data[2].x = response.x;
                // this.graphPlot.data[2].y = response.y;
                // const data = response.x.map(function (x, i) { return [new Date(x).getTime(), parseInt(response.y[i], 10)]; });

                // Making small values visible
                const data = response.x.map(function (x, i) {

                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null, 10];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                // this.charter.addSerie({name: 'c', color: this.cTypeColor, data: data});
                this.chart.series[2].setData(data, false, false,  false);
                this.chartOverview.series[2].setData(data, false, false,  false);
                console.log('Graph data loaded async! - c', response);
                this.loadingCTimes = false;
                this.chartDataLoaded();
            });

        // Loading mactimes - birth
        this.manager.getData('b')
            .then(response => {
                // this.graphPlot.data[3].x = response.x;
                // this.graphPlot.data[3].y = response.y;
                // const data = response.x.map(function (x, i) { return [new Date(x).getTime(), parseInt(response.y[i], 10)]; });

                // Making small values visible
                const data = response.x.map(function (x, i) {

                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null, 10];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                // this.charter.addSerie({name: 'b', color: this.bTypeColor, data: data});
                this.chart.series[3].setData(data, false, false,  false);
                this.chartOverview.series[3].setData(data, false, false,  false);
                console.log('Graph data loaded async! - b', response);

                this.loadingBTimes = false;
                this.chartDataLoaded();
            });

        // Load counts of all timestamps
        this.manager.getData()
            .then(response => {
                // this.graphPlot.data[3].x = response.x;
                // this.graphPlot.data[3].y = response.y;
                // const data = response.x.map(function (x, i) { return [new Date(x).getTime(), parseInt(response.y[i], 10)]; });

                // Making small values visible
                const data = response.x.map(function (x, i) {

                    if (parseInt(response.y[i], 10) === 0) {
                        return [new Date(x).getTime(), null, 10];
                    } else {
                        return [new Date(x).getTime(), parseInt(response.y[i], 10)];
                    }
                });

                // this.charter.addSerie({name: 'b', color: this.bTypeColor, data: data});
                this.chart.series[4].setData(data, false, false,  false);
                this.chartOverview.series[4].setData(data, false, false,  false);
                console.log('Graph data loaded async! - all', response);



                // Setting boundary to fix range of dates in graph when changing timestamps types
                this.min_date_boundary = data[0][0];
                this.max_date_boundary = data[data.length - 1][0] + 24 * 3600*1000;


                this.chart.xAxis[0].update({
                    min: this.min_date_boundary,
                    max: this.max_date_boundary
                });

                this.chartOverview.xAxis[0].update({
                    min: this.min_date_boundary,
                    max: this.max_date_boundary
                });

                this.loadingAllTimes = false;
                this.chartDataLoaded();
                this.showHideTrace('all');
            });

    }

    chartDataLoaded() {
        if (!this.loadingMTimes && !this.loadingATimes && !this.loadingCTimes && !this.loadingBTimes && !this.loadingAllTimes) {
            this.chart.redraw(false);
            this.chartOverview.redraw(false);
        }
    }

    graphZoom(x1, x2) {
        console.log('graph zooming', x1, x2);
        this.dateChangeDebouncer.next([x1, x2]);
        let isoString = new Date(x1).toISOString();
        this.pickedFromDate = isoString.substring(0, isoString.length - 1);
        isoString = new Date(x2).toISOString();
        this.pickedToDate = isoString.substring(0, isoString.length - 1);
        this.saveGraphZoom = true;
    }

    graphOverviewZoomLabel(from: number, to: number) {
        this.chartOverview.xAxis[0].removePlotBand('mask-before');
        this.chartOverview.xAxis[0].addPlotBand({
            id: 'mask-before',
            from: this.chartOverview.xAxis[0].dataMin,
            to: from,
            color: 'rgba(30, 30, 30, 0.4)'
        });
        this.chartOverview.xAxis[0].removePlotBand('mask-after');
        this.chartOverview.xAxis[0].addPlotBand({
            id: 'mask-after',
            from: to,
            to: this.chartOverview.xAxis[0].dataMax,
            color: 'rgba(30, 30, 30, 0.4)'
        });
    }

    updateBoundary() {
        this.saveGraphZoom = true;
        this.chart.xAxis[0].setExtremes(new Date(this.pickedFromDate).getTime(), new Date(this.pickedToDate).getTime());
        this.graphOverviewZoomLabel(new Date(this.pickedFromDate).getTime(), new Date(this.pickedToDate).getTime());
        // this.chart.showResetZoom();
        this.dateChangeDebouncer.next([
            this.pickedFromDate.replace('T', ' '),
            this.pickedToDate.replace('T', ' ')]);
    }

    collapseGraphPanel() {
        this.graphPanelOpenState = !this.graphPanelOpenState;
        this.openStateChange.emit(this.graphPanelOpenState);
    }

    showHideTrace(metadataType) {
        console.log(this.chart.series[0].visible);
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

    typeCheckboxChanged(type) {
        if (this.selectedTypes.has(type)) {
            this.selectedTypes.delete(type);
        } else {
            this.selectedTypes.add(type);
        }
        this.showHideTrace(type);
        this.typesChanged.emit(this.selectedTypes);
        console.log('selected metadata types changed', this.selectedTypes);
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
        console.log(new Date(this.max_date_boundary).getTime());
        this.chart.xAxis[0].setExtremes(new Date(this.min_date_boundary).getTime(), new Date(this.max_date_boundary).getTime());
        this.chartOverview.xAxis[0].setExtremes(new Date(this.min_date_boundary).getTime(), new Date(this.max_date_boundary).getTime());
        this.chart.redraw();
        this.graphOverviewZoomLabel(new Date(this.pickedFromDate).getTime(), new Date(this.max_date_boundary).getTime());
        this.dateChangeDebouncer.next([
            this.pickedFromDate.replace('T', ' '),
            this.pickedToDate.replace('T', ' ')]);

        console.log(this.chart.xAxis[0].dataMin);
    }
}
