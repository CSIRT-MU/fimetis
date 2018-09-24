import {Component, OnInit, Input, ViewChild, ElementRef, Output, EventEmitter} from '@angular/core';
import {ElasticsearchService} from '../../elasticsearch.service';
import * as d3 from 'd3';
import * as Plotly from 'plotly.js';

@Component({
  selector: 'app-show-graph',
  templateUrl: './show-graph.component.html',
  styleUrls: ['./show-graph.component.css']
})
export class ShowGraphComponent implements OnInit {

  @Input() _index: string;
  @Input() _type: string;
  @Input() _case: string;
  @Input() _filter: string;
  @Input() _clusters: string[];
  @Input() _frequency: string;
  @Output() getDateChange = new EventEmitter<boolean>();
  @Input() fromDate: Date;

  @ViewChild('graph') private chartElement: ElementRef;
  @ViewChild('plot_div') private plotElement: ElementRef;

  private data: any;

  private margin: any = { top: 20, bottom: 140, left: 50, right: 20};
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
    // data: {x: [], y: [], type: 'scatter', mode: 'lines+points', marker: {color: 'red'}},
    // layout: {width: 320, height: 240, title: 'A Fancy Plot'}
    data: [
       { x: ['1970-01-01T00:00:00.000Z'], y: [0], name: 'mtime', type: 'scatter', mode: 'lines+points', marker: {color: '#FF7F0E'}},
      { x: ['1970-01-01T00:00:00.000Z'], y: [0], name: 'atime', type: 'scatter', mode: 'lines+points', marker: {color: '#D62728'}},
      { x: ['1970-01-01T00:00:00.000Z'], y: [0], name: 'ctime', type: 'scatter', mode: 'lines+points', marker: {color: '#2CA02C'}},
      { x: ['1970-01-01T00:00:00.000Z'], y: [0], name: 'btime', type: 'scatter', mode: 'lines+points', marker: {color: '#976CBF'}},
      // { x: [1, 2, 3], y: [2, 5, 3], type: 'bar' },
    ],
    layout: {autosize: true, xaxis: {range: []}, dataversion: 0, showlegend: true} // log y axis > yaxis: {type: 'log'}
  };

  constructor(private es: ElasticsearchService) { }

  ngOnInit() {
    this.loadingMTimes = true;
    this.loadingATimes = true;
    this.loadingCTimes = true;
    this.loadingBTimes = true;
    this.es.getFilteredGraphData(this._index, this._type, this._case, 'm', this._filter, this._clusters, this._frequency).then(
      response => {
        this.data = response.aggregations.dates.buckets;
        // this.createChart();
        // if (this.data) {
        //   this.updateChart();
        // }
        this.graphPlot.data[0].x = this.data.map(d => d['key_as_string']);
        this.graphPlot.data[0].y = this.data.map(d => d['doc_count']);

        // console.log(response);
      }, error => {
        console.error(error);
      }).then(() => {
      console.log('Graph data loaded! - mtime');
      this.loadingMTimes = false;
    });
    this.es.getFilteredGraphData(this._index, this._type, this._case, 'a', this._filter, this._clusters, this._frequency).then(
      response => {
        this.data = response.aggregations.dates.buckets;
        // this.createChart();
        // if (this.data) {
        //   this.updateChart();
        // }
        this.graphPlot.data[1].x = this.data.map(d => d['key_as_string']);
        this.graphPlot.data[1].y = this.data.map(d => d['doc_count']);

        // console.log(response);
      }, error => {
        console.error(error);
      }).then(() => {
      console.log('Graph data loaded! - atime');
      this.loadingATimes = false;
    });
    this.es.getFilteredGraphData(this._index, this._type, this._case, 'c', this._filter, this._clusters, this._frequency).then(
      response => {
        this.data = response.aggregations.dates.buckets;
        // this.createChart();
        // if (this.data) {
        //   this.updateChart();
        // }
        this.graphPlot.data[2].x = this.data.map(d => d['key_as_string']);
        this.graphPlot.data[2].y = this.data.map(d => d['doc_count']);

        // console.log(response);
      }, error => {
        console.error(error);
      }).then(() => {
      console.log('Graph data loaded! - ctime');
      this.loadingCTimes = false;
    });
    this.es.getFilteredGraphData(this._index, this._type, this._case, 'b', this._filter, this._clusters, this._frequency).then(
      response => {
        this.data = response.aggregations.dates.buckets;
        // this.createChart();
        // if (this.data) {
        //   this.updateChart();
        // }
        this.graphPlot.data[3].x = this.data.map(d => d['key_as_string']);
        this.graphPlot.data[3].y = this.data.map(d => d['doc_count']);

        // console.log(response);
      }, error => {
        console.error(error);
      }).then(() => {
      console.log('Graph data loaded! - btime');
      this.loadingBTimes = false;
    });

    // make graph responsive
    const plotDiv = document.getElementById(this.plotDivIdentifier);
    window.onresize = function() {
      Plotly.Plots.resize(plotDiv);
    };
  }

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
    console.log('zoom', $event['xaxis.range[0]'], $event['xaxis.range[1]']);
    this.getDateChange.emit($event);
  }

  setFromBoundary(fromDate) {
    console.log('from-date change + ' + fromDate['value'] );
    const date = new Date(fromDate['value']);
    const dateString = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' 00:00:00.0000';
    // const update = {'xaxis.range[0]': dateString};
    const reference = document.getElementById(this.plotDivIdentifier);
    this.graphPlot.layout.xaxis.range[0] = dateString;
    this.graphPlot.layout.dataversion += 1;
    console.log('setup xaxis [0]', this.graphPlot.layout.xaxis.range[0]);
  }

  setToBoundary(toDate) {
    console.log('to-date change + ' + toDate['value'] );
    const date = new Date(toDate['value']);
    const dateString = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' 00:00:00.0000';
    // const update = {'xaxis.range[1]': dateString};
    const reference = document.getElementById(this.plotDivIdentifier);
    this.graphPlot.layout.xaxis.range[1] = dateString;
    this.graphPlot.layout.dataversion += 1;
    console.log('setup xaxis [1]', this.graphPlot.layout.xaxis.range[1]);
  }
}
