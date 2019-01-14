import {Component, OnInit, Input, ViewChild, ElementRef, Output, EventEmitter} from '@angular/core';
import {ElasticsearchService} from '../../elasticsearch.service';
import * as d3 from 'd3';
import * as Plotly from 'plotly.js';
import {GraphManager} from '../../businessLayer/graphManager';
import {ClusterModel} from '../../models/cluster.model';
import {Subject} from 'rxjs';
import {debounceTime} from 'rxjs/operators';

@Component({
    selector: 'app-graph',
    templateUrl: './graph.component.html',
    styleUrls: ['./graph.component.css']
})
export class GraphComponent implements OnInit {

    @Input() _case: string;
    @Input() _filter: string;
    @Input() _clusters: ClusterModel[] = [];
    @Input() _frequency: string;
    @Output() getDateChange = new EventEmitter<[string, string]>();
    // debouncer is used to emit values once in a time. Solves the problem with a lot of calls to db
    dateChangeDebouncer: Subject<[string, string]> = new Subject();
    @Output() openStateChange = new EventEmitter<boolean>();
    @Input() fromDate: Date;

    @ViewChild('graph') private chartElement: ElementRef;
    @ViewChild('plot_div') private plotElement: ElementRef;

    @Input()
    graphPanelOpenState = true;

    pickedFromDate = '1970-01-01T00:00:00';
    pickedToDate = '1970-01-01T00:00:00';

    private data: any;
    private manager;

    private margin: any = {top: 20, bottom: 140, left: 50, right: 20};
    private chart: any;
    private width: number;
    private height: number;
    private xScale: any;
    private yScale: any;
    private colors: any;
    private xAxis: any;
    private yAxis: any;

    loadingMTimes = false;
    loadingATimes = false;
    loadingCTimes = false;
    loadingBTimes = false;

    // Plotly
    public plotDivIdentifier = 'plot_div';

    public graphPlot = {
        data: [
            // {x: ['1970-01-01T00:00:00.000Z'], y: [0], name: 'mtime', type: 'bar', marker: {color: '#FF7F0E'}},
            // {x: ['1970-01-01T00:00:00.000Z'], y: [0], name: 'atime', type: 'bar', marker: {color: '#D62728'}},
            // {x: ['1970-01-01T00:00:00.000Z'], y: [0], name: 'ctime', type: 'bar', marker: {color: '#2CA02C'}},
            // {x: ['1970-01-01T00:00:00.000Z'], y: [0], name: 'btime', type: 'bar', marker: {color: '#976CBF'}},
            {x: ['1970-01-01T00:00:00.000Z'], y: [0], name: 'm',
                type: 'scatter', mode: 'lines+points', marker: {color: '#FF7F0E'}, visible: true, connectgaps: true},
            {x: ['1970-01-01T00:00:00.000Z'], y: [0], name: 'a',
                type: 'scatter', mode: 'lines+points', marker: {color: '#D62728'}, visible: true, connectgaps: true},
            {x: ['1970-01-01T00:00:00.000Z'], y: [0], name: 'c',
                type: 'scatter', mode: 'lines+points', marker: {color: '#2CA02C'}, visible: true, connectgaps: true},
            {x: ['1970-01-01T00:00:00.000Z'], y: [0], name: 'b',
                type: 'scatter', mode: 'lines+points', marker: {color: '#976CBF'}, visible: true, connectgaps: true},
            // { x: [1, 2, 3], y: [2, 5, 3], type: 'bar' },
        ],
        layout: {autosize: true, xaxis: {range: [], rangeslider: {}}, dataversion: 0, showlegend: false,
            margin: {t: 5, b: 20}, height: 200, yaxis: {type: 'log'}}, // log y axis > yaxis: {type: 'log'}
        config: {displayModeBar: false}
    };

    constructor(private es: ElasticsearchService) {
        this.manager = new GraphManager(es);
        // debouncer setup
        this.dateChangeDebouncer.pipe(debounceTime(100)).subscribe((value) => this.getDateChange.emit(value));

    }


    ngOnInit() {
    }


    /**
     * Plotly graph initialization
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
                this.graphPlot.data[0].x = response.x;
                this.graphPlot.data[0].y = response.y;
                this.loadingMTimes = false;
                console.log('Graph data loaded async! - m', response);

            });

        // Loading mactimes - access
        this.manager.getData('a')
            .then(response => {
                this.graphPlot.data[1].x = response.x;
                this.graphPlot.data[1].y = response.y;
                this.loadingATimes = false;
                console.log('Graph data loaded async! - a', response);
            });

        // Loading mactimes - changed
        this.manager.getData('c')
            .then(response => {
                this.graphPlot.data[2].x = response.x;
                this.graphPlot.data[2].y = response.y;
                this.loadingCTimes = false;
                console.log('Graph data loaded async! - c', response);
            });

        // Loading mactimes - birth
        this.manager.getData('b')
            .then(response => {
                this.graphPlot.data[3].x = response.x;
                this.graphPlot.data[3].y = response.y;
                this.loadingBTimes = false;
                console.log('Graph data loaded async! - b', response);
            });

        console.log(this.graphPlot.data);
    }

    /**
     * d3.js graph initialization
     */
    // createChart() {
    //   const element = this.chartElement.nativeElement;
    //   this.width = element.offsetWidth - this.margin.left - this.margin.right;
    //   this.height = element.offsetHeight - this.margin.top - this.margin.bottom;
    //   const svg = d3.select(element).append('svg')
    //     .attr('width', element.offsetWidth)
    //     .attr('height', element.offsetHeight);
    //   // chart plot area
    //   this.chart = svg.append('g')
    //     .attr('class', 'bars')
    //     .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);
    //   // define X & Y domains
    //   const xDomain = this.data.map(d => d['key_as_string']);
    //   console.log('GRAPH DOC COUNTS' + this.data.map(d => d['doc_count']));
    //   const yDomain = [0, d3.max(this.data, d => d['doc_count'])];
    //
    //   var totalNums = 0;
    //   var countField = this.data.map(d => d['doc_count']).map(Number);
    //   for ( var i = 0; i < xDomain.length; i++){
    //     totalNums += countField[i];
    //   }
    //   console.log('sum of all data points >' + totalNums + '<');
    //   // create scales
    //   this.xScale = d3.scaleBand()
    //     .padding(0.1)
    //     .domain(xDomain)
    //     .rangeRound([0, this.width]);
    //   this.yScale = d3.scaleLinear()
    //     .domain(yDomain.map(Number))
    //     // .domain([1000, 100, 150])
    //     .range([this.height, 0]);
    //   // bar colors
    //   this.colors = d3.scaleLinear()
    //     .domain([0, this.data.length])
    //     .range(<any[]>['grey', 'cyan']);
    //   // x & y axis
    //   this.xAxis = svg.append('g')
    //     .attr('class', 'axis axis-x')
    //     .attr('transform', `translate(${this.margin.left}, ${this.margin.top + this.height})`)
    //     .call(d3.axisBottom(this.xScale))
    //     .selectAll('text')
    //     .style('text-anchor', 'end')
    //     .attr('dx', '-.8em')
    //     .attr('dy', '.15em')
    //     .style('fill', '#333')
    //     // .style('font-size','2')
    //     .attr('transform', 'rotate(-65)' );
    //   this.yAxis = svg.append('g')
    //     .attr('class', 'axis axis-y')
    //     .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`)
    //     .call(d3.axisLeft(this.yScale));
    // }
    //
    // updateChart() {
    //   // update scales & axis
    //   this.xScale.domain(this.data.map(d => d.key_as_string));
    //   this.yScale.domain([0, d3.max(this.data, d => d['doc_count'])]);
    //   this.colors.domain([0, this.data.length]);
    //   this.xAxis.transition().call(d3.axisBottom(this.xScale));
    //   this.yAxis.transition().call(d3.axisLeft(this.yScale));
    //
    //   const update = this.chart.selectAll('.bar')
    //     .data(this.data);
    //
    //   // remove exiting bars
    //   update.exit().remove();
    //
    //   // update existing bars
    //   this.chart.selectAll('.bar').transition()
    //     .attr('x', d => this.xScale(d['key_as_string']))
    //     .attr('y', d => this.yScale(d['doc_count']))
    //     .attr('width', d => this.xScale.bandwidth())
    //     .attr('height', d => this.height - this.yScale(d['doc_count']))
    //     .style('fill', (d, i) => this.colors(i));
    //
    //   // add new bars
    //   update
    //     .enter()
    //     .append('rect')
    //     .attr('class', 'bar')
    //     .attr('x', d => this.xScale(d['key_as_string']))
    //     .attr('y', d => this.yScale(0))
    //     .attr('width', this.xScale.bandwidth())
    //     .attr('height', 0)
    //     .style('fill', (d, i) => this.colors(i))
    //     .transition()
    //     .delay((d, i) => i * 10)
    //     .attr('y', d => this.yScale(d['doc_count']))
    //     .attr('height', d => this.height - this.yScale(d['doc_count']));
    // }

    pickedZoomFunction($event) {
        console.log('graph zoom', $event);
        // let from;
        // let to;
        // if ($event['xaxis.range'] === undefined && ($event['xaxis.range[0]'] === undefined || $event['xaxis.range[1]'] === undefined)) {
        //     // zoom out after double click
        //     // from = this.lastInitUpdateOfPickedFromDate;
        //     // to = this.lastInitUpdateOfPickedToDate;
        //     from = this.graphPlot.layout.xaxis.range[0];
        //     to = this.graphPlot.layout.xaxis.range[1];
        //     // this.pickedFromDate = from;
        //     // this.pickedToDate = to;
        // } else {
        //     // zoom by selecting area in graph
        //     from = $event['xaxis.range[0]'];
        //     if (from === undefined || from == null) {
        //         from = $event['xaxis.range'][0];
        //     }
        //     to = $event['xaxis.range[1]'];
        //     if (to === undefined || to == null) {
        //         to = $event['xaxis.range'][1];
        //     }
        //     // let isoString = new Date(from).toISOString();
        //     // this.pickedFromDate = isoString.substring(0, isoString.length - 1);
        //     // isoString = new Date(to).toISOString();
        //     // this.pickedToDate = isoString.substring(0, isoString.length - 1);
        // }
        let isoString = new Date(this.graphPlot.layout.xaxis.range[0]).toISOString();
        this.pickedFromDate = isoString.substring(0, isoString.length - 1);
        isoString = new Date(this.graphPlot.layout.xaxis.range[1]).toISOString();
        this.pickedToDate = isoString.substring(0, isoString.length - 1);
        console.log('graph zoom', this.graphPlot.layout.xaxis.range[0], this.graphPlot.layout.xaxis.range[1]);
        // this.getDateChange.emit([from, to]);
        this.dateChangeDebouncer.next([
            this.graphPlot.layout.xaxis.range[0],
            this.graphPlot.layout.xaxis.range[1]]);
    }

    setFromBoundary(fromDate) {
        console.log('from-date change + ' + fromDate['value']);
        const date = new Date(fromDate['value']);
        const dateString = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' 00:00:00.0000';
        // const update = {'xaxis.range[0]': dateString};
        const reference = document.getElementById(this.plotDivIdentifier);
        this.graphPlot.layout.xaxis.range[0] = dateString;
        this.graphPlot.layout.dataversion += 1;
        console.log('setup xaxis [0]', this.graphPlot.layout.xaxis.range[0]);
    }

    setToBoundary(toDate) {
        console.log('to-date change + ' + toDate['value']);
        const date = new Date(toDate['value']);
        const dateString = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' 00:00:00.0000';
        // const update = {'xaxis.range[1]': dateString};
        const reference = document.getElementById(this.plotDivIdentifier);
        this.graphPlot.layout.xaxis.range[1] = dateString;
        this.graphPlot.layout.dataversion += 1;
        console.log('setup xaxis [1]', this.graphPlot.layout.xaxis.range[1]);
    }

    updateBoundary() {
        const update = {
            xaxis: {range: [this.pickedFromDate, this.pickedToDate], rangeslider: {}}
        };
        Plotly.relayout(document.getElementById(this.plotDivIdentifier), update);
        // this.graphPlot.layout.xaxis.range = [this.pickedFromDate, this.pickedToDate];
        // this.graphPlot.layout.xaxis.rangeslider = [this.pickedFromDate, this.pickedToDate];
        // // this.graphPlot.layout.dataversion += 1;
        // Plotly.relayout(document.getElementById(this.plotDivIdentifier), this.graphPlot.layout).catch(error => {
        //    console.log('update graph boundary error', error);
        // });
        this.dateChangeDebouncer.next([
            this.pickedFromDate.replace('T', ' '),
            this.pickedToDate.replace('T', ' ')]);
    }

    collapseGraphPanel() {
        this.graphPanelOpenState = !this.graphPanelOpenState;
        this.openStateChange.emit(this.graphPanelOpenState);
    }

    graphUpdated($event) {
        console.log('graph updated', $event, $event['layout'].xaxis);
        let isoString = new Date($event['layout'].xaxis.range[0]).toISOString();
        this.pickedFromDate = isoString.substring(0, isoString.length - 1);
        isoString = new Date($event['layout'].xaxis.range[1]).toISOString();
        this.pickedToDate = isoString.substring(0, isoString.length - 1);
    }

    showHideTrace(metadataType) {
        for (let index = 0; index < this.graphPlot.data.length; index++) {
            if (this.graphPlot.data[index].name === metadataType) {
                this.graphPlot.data[index].visible = !this.graphPlot.data[index].visible;
            }
        }
    }
}
