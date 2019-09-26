import {AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild} from '@angular/core';
import * as d3 from 'd3';
import {Observable, Subject, Subscription} from 'rxjs';
import {bisect, select} from 'd3';
import {debounceTime, map} from 'rxjs/operators';
import {Hotkey, HotkeysService} from 'angular2-hotkeys';
import {transformAll} from '@angular/compiler/src/render3/r3_ast';
import {BaseService} from '../../../services/base.service';
import {ToastrService} from 'ngx-toastr';
import {StateService} from '../../../services/state.service';


export interface HistogramData {
    data: number[][];
    color: string;
    name: string;
    maxValue: number;
}

@Component({
    selector: 'app-d3-histogram',
    templateUrl: './d3Histogram.component.html',
    styleUrls: ['./d3Histogram.component.css']
})
export class D3HistogramComponent implements OnDestroy {

    @ViewChild('chart', {static: false})
    private chartContainer: ElementRef;

    @Input()
    data_months: HistogramData[] = [];
    @Input()
    data_weeks: HistogramData[] = [];
    @Input()
    data_days: HistogramData[] = [];
    @Input()
    data_hours: HistogramData[] = [];

    @Input()
    data: HistogramData[] = [];


    @Input()
    selectedTypes: Set<string> = new Set<string>(['m', 'a', 'c', 'b']);

    @Input()
    filteredDataMonths: HistogramData[] = [];
    @Input()
    filteredDataWeeks: HistogramData[] = [];
    @Input()
    filteredDataDays: HistogramData[] = [];
    @Input()
    filteredDataHours: HistogramData [] =  [];

    @Input()
    filteredData: HistogramData[] = [];

    @Input()
    searchString: string;

    @Input()
    min_date_boundary: any;
    @Input()
    max_date_boundary: any;
    // @Input()
    // // selectedTypes = ['m', 'a', 'c', 'b'];
    windowPosition = {from: null, to: null};

    selectedSelectionIndex = -1;

    selectedExtendOption = 'day';
    extendOptions = ['day', 'hour', 'week', 'month'];

    extendValue = 1;


    selections = [];
    @Output() selectionsEmitter = new EventEmitter<any[]>();
    // debouncer is used to emit values once in a time. Solves the problem with a lot of calls to db
    selectionsDebouncer: Subject<any[]> = new Subject();

    @Output() scrollToBar = new EventEmitter<Date>();

    @Output() scrollMarkToIndex = new EventEmitter<Number>();

    marks = new Map();

    margin = { top: 30, right: 40, bottom: 40, left: 50 };
    savedZoomProperties = null;

    granularity_level = '';

    private subscriptions: Subscription[] = [];

    constructor(private _hotkeysService: HotkeysService,
                private toaster: ToastrService,
                private baseService: BaseService,
                private stateService: StateService) {
        // this.subscriptions.push(this.selectionsDebouncer.pipe(debounceTime(500)).subscribe((value) => this.selectionsEmitter.emit(value)));
        this.subscriptions.push(this.selectionsDebouncer.pipe(debounceTime(500)).subscribe((value) => stateService.selections = value));
        this.subscriptions.push(this.stateService.currentStateSelections.subscribe((value) => this.setSelectionsWithoutEmit(value)));
        this._hotkeysService.add(new Hotkey(['ctrl+right', 'meta+right'], (event: KeyboardEvent): boolean => {
            // shift graph view to right
            d3.selectAll('.zoomNavRight').dispatch('click');
            return false; // Prevent bubbling
        }, undefined, 'Shift zoomed histogram view to the right'));
        this._hotkeysService.add(new Hotkey(['ctrl+left', 'command+left'], (event: KeyboardEvent): boolean => {
            // shift graph view to left
            d3.selectAll('.zoomNavLeft').dispatch('click');
            return false; // Prevent bubbling
        }, undefined, 'Shift zoomed histogram view to the left'));
        this._hotkeysService.add(new Hotkey(['ctrl+0', 'command+0'], (event: KeyboardEvent): boolean => {
            // shift graph view to left
            d3.select('.resetZoomButton').dispatch('click');
            return false; // Prevent bubbling
        }, undefined, 'Reset histogram zoom'));
        this._hotkeysService.add(new Hotkey(['ctrl+del', 'command+del'], (event: KeyboardEvent): boolean => {
            // remove all time range selections
            d3.select('.removeAllSelectionsButton').dispatch('click');
            return false; // Prevent bubbling
        }, undefined, 'Remove all time range selections'));
        this._hotkeysService.add(new Hotkey(['ctrl+plus', 'command+plus'], (event: KeyboardEvent): boolean => {
            // zoom in histogram
            d3.select('.zoomPlusButton').dispatch('click');
            return false; // Prevent bubbling
        }, undefined, 'Zoom in histogram'));
        this._hotkeysService.add(new Hotkey(['ctrl+-', 'command+-'], (event: KeyboardEvent): boolean => {
            // zoom out histogram
            d3.select('.zoomMinusButton').dispatch('click');
            return false; // Prevent bubbling
        }, undefined, 'Zoom out histogram'));
        this._hotkeysService.add(new Hotkey(['ctrl+alt+s', 'command+alt+s'], (event: KeyboardEvent): boolean => {
            // select zoomed area in histogram
            d3.select('.selectActualAreaButton').dispatch('click');
            return false; // Prevent bubbling
        }, undefined, 'Select zoomed area in histogram'));

    }

    ngOnDestroy() {
        this.subscriptions.forEach(subscription => subscription.unsubscribe());
    }

    createChart() {
        const thisClass = this;
        const element = this.chartContainer.nativeElement;

        const data_months = this.data_months;
        const data_weeks = this.data_weeks;
        const data_days = this.data_days;
        const data_hours = this.data_hours;
        const data = this.data;

        const filteredData = this.filteredData;


        let month_width = 1;
        let week_width = 1;
        let day_width = 1;
        let hour_width = 1;
        let barWidth = 1;

        const margin = this.margin;
        const zoomSideShadowWidth = 70;
        const zoomFactor = 0.9;
        const hoverAreaOffset = {left: 20, right: 60};
        // valid zoom parameters
        let lastValidZoomFactor = 1.0;
        let lastValidZoomRange = [];
        let lastValidZoomX = 0;
        // let shiftKey = false;
        // maximum difference between [ first data | last date ] and the edge of the graph, used for boundaries when
        const maxEdgeMargin = 100;

        // Actual width of bar ratio, = 0.9 bar, 0.05 margin on left, 0.05 margin on right
        const barWidthWithMarginsRatio = 0.9;



        d3.select(element).select('svg').remove();

        const zoom = d3.zoom()
            .scaleExtent([1, 10000])
            .translateExtent([[0, 0], [element.offsetWidth, element.offsetHeight]])
            .on('zoom', zoomed);

        const drag = d3.drag()
            .on('start', dragStart)
            .on('end', dragEnd)
            .on('drag', dragging)
            .filter(function() {return !d3.event.button; });

        const svg = d3.select(element).append('svg')
            .attr('width', element.offsetWidth)
            .attr('height', element.offsetHeight + 10)
            .style('margin-top', '10px')
            // .style('margin-bottom', '100px')
            // .attr('margin-top', '-40px')
            // .on('wheel', wheeled)
            .on('mousemove', function () {
                const xAxisPos = d3.mouse(this)[0] - margin.left;
                const yAxisPos = d3.mouse(this)[1] - margin.top;

                if (yAxisPos < 0) {
                    d3.select(this).style('cursor', 'default');
                    return;
                }

                d3.selectAll('.selectionHoverArea').style('visibility', 'hidden');
                for (let index = 0; index < thisClass.selections.length; index++) {
                    if (xAxisPos > (actualX(thisClass.selections[index][0]) - hoverAreaOffset.left) &&
                        xAxisPos < (actualX(thisClass.selections[index][1]) + hoverAreaOffset.right)) {
                        d3.selectAll('.selectionHoverArea-' + index).style('visibility', 'visible');
                    }
                }

                // On mouseover unselected selection change cursor to pointer
                for (let i = 0; i < thisClass.selections.length; i++ ) {
                    // if (xAxisPos > (actualX(thisClass.selections[i][0])) &&
                    //     xAxisPos < (actualX(thisClass.selections[i][1])) && i !== thisClass.selectedSelectionIndex) {
                    if (xAxisPos > (actualX(thisClass.selections[i][0])) &&
                         xAxisPos < (actualX(thisClass.selections[i][1]))) {

                          d3.select(this).style('cursor', 'pointer');
                        //d3.select(this).style('cursor', 'url("https://cdn4.iconfinder.com/data/icons/podcast-collection/100/delete-512.png"), auto');
                        return;
                    }
                }
                d3.select(this).style('cursor', 'default');
            })
            .on('mouseleave', function () {
                d3.selectAll('.selectionHoverArea').style('visibility', 'hidden');
            })
            .on('click', selectSelection)
            .call(drag)
            .call(zoom);

        // buttons (+ hidden buttons)
        d3.select('.zoomPlusButton').on('click', zoomPlus);
        d3.select('.zoomMinusButton').on('click', zoomMinus);
        d3.select('.resetZoomButton').on('click', zoomOut);
        d3.select('.removeAllSelectionsButton').on('click', removeAllSelections);
        d3.select('.zoomIntoSelectionButton').on('click', zoomIn);
        d3.select('.extendSelectionBack').on('click', extendSelectionBack);
        d3.select('.extendSelectionForth').on('click', extendSelectionForth);
        d3.select('.removeSelectionButton').on('click', removeSelection);

        //svg.selectAll('.removeSelectionButton').on('mousedown', removeSelection);

        //const a = this.selections[this.selectedSelectionIndex];
        // svg.selectAll('.removeAllSelectionsButton').remove();
        // svg.append('rect')
        //     .attr('class', 'removeAllSelectionsButton')
        //     .style('visibility', 'hidden')
        //     .on('click', function () {
        //         drawSelections();
        //         drawActualPositionWindow();
        //     });
        svg.selectAll('.resetSelectionsButton').remove();
        svg.append('rect')
            .attr('class', 'resetSelectionsButton')
            .style('visibility', 'hidden')
            .on('click', selectionsReset);
        svg.selectAll('.selectActualAreaButton').remove();
        svg.append('rect')
            .attr('class', 'selectActualAreaButton')
            .style('visibility', 'hidden')
            .on('click', selectActualArea);

        const contentWidth = element.offsetWidth - this.margin.left - this.margin.right;
        const contentHeight = element.offsetHeight - this.margin.top - this.margin.bottom - 20;

        const mask = svg.append('defs').append('mask').attr('id', 'shadowMask');
        const leftMask = svg.append('defs').append('mask').attr('id', 'leftShadowMask');
        const rightMask = svg.append('defs').append('mask').attr('id', 'rightShadowMask');

        // color gradients
        const leftColorGradient = svg.append('defs').append('linearGradient')
            .attr('id', 'GradientLeft')
            .attr('x1', 0)
            .attr('x2', 1)
            .attr('y1', 0)
            .attr('y2', 0);
        leftColorGradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#ffffff');
        leftColorGradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#000000');
        const rightColorGradient = svg.append('defs').append('linearGradient')
            .attr('id', 'GradientRight')
            .attr('x1', 0)
            .attr('x2', 1)
            .attr('y1', 0)
            .attr('y2', 0);
        rightColorGradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#000000');
        rightColorGradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#ffffff');

        // Add a clipPath: everything out of this area won't be drawn.
        const clip = svg.append('defs').append('svg:clipPath')
            .attr('id', 'clip')
            .append('svg:rect')
            .attr('width', contentWidth)
            .attr('height', element.offsetHeight )
            .attr('x', 0)
            .attr('y',  0);

        // clip path with offset values
        const offsetClip = svg.append('defs').append('svg:clipPath')
            .attr('id', 'offsetClip')
            .append('svg:rect')
            .attr('width', contentWidth)
            .attr('height', element.offsetHeight )
            .attr('x', margin.left)
            .attr('y',  0);

        // clip path with offset values
        const positionWindowClip = svg.append('defs').append('svg:clipPath')
            .attr('id', 'positionWindowClip');

        d3.selectAll('.tooltip').remove();
        const tooltip = d3.select(element)
            .append('div')
            .attr('class', 'tooltip')
            .style('opacity', 1)
            .style('display', 'none')
            .style('background-color', '#fefefe')
            .style('border', 'solid')
            .style('border-width', '2px')
            .style('border-radius', '5px')
            .style('padding', '3px');

        const firstDate = new Date(this.min_date_boundary - (24 * 3600 * 1000));
        const lastDate = new Date(this.max_date_boundary + (24 * 3600 * 1000));

        for (const dataItem of data_days) {
            dataItem.maxValue = d3.max(dataItem.data, d => d[1]);
        }

        const x = d3
            .scaleTime()
            .domain([firstDate, lastDate])
            .rangeRound([0, contentWidth]);

        // const y = d3
        //     .scaleLinear()
        //     .rangeRound([contentHeight, 0])
        //     .domain([0, d3.max(data, d => d.maxValue)]);


        // Returns ticks in ascending order, last one is also maximum of Y axis
        function countTickValues() {
            const maximum = d3.max(data_days, d => d.maxValue);

            if (maximum === undefined) {
                // just small basic ticks, if no data loaded
                return [1, 10];
            }
            const tickvalues = [];

            let tick = 1;
            while (tick <= maximum) {
                tickvalues.push(tick);
                tick *= 10;
            }
            tickvalues.push(tick);
            tickvalues.push(tick * 10);

            return tickvalues;
        }

        const y = d3
            .scaleLog()
            .domain([1, countTickValues()[countTickValues().length - 1]])
            .rangeRound([contentHeight, 0])
            .base(10);

        let actualX = x;
        const actualY = y;


        const g = svg.append('g')
            .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')
            .attr('clip-path', 'url(#clip)')
        ;

        // const mask = svg.append('mask').attr('id', 'maskurl');

        const xAxis = svg.append('g')
            .attr('class', 'axis axis--x')
            .attr('transform', 'translate(' + this.margin.left + ',' + (contentHeight + this.margin.top) + ')')
            .call(d3.axisBottom(x));




        const yAxis = svg.append('g')
            .attr('class', 'axis axis--y')
            .attr('transform', 'translate(' + this.margin.left + ', ' + margin.top + ')')
            // .call(d3.axisLeft(y).ticks(10))
            .call(d3.axisLeft(y)
                .tickSize(- contentWidth)
                .tickValues(countTickValues())
                .tickFormat(d3.format('.1s'))
            //     .tickFormat( function (d) {
            //         console.log(typeof d);
            //         let out = d + '';
            //         if ((d / 1000000) >= 1) {
            //             out = d / 1000000 + 'M';
            //         }
            //         else if ((d / 1000) >= 1) {
            //             out = d / 1000 + 'K';
            //         }
            //     return out;
            // })
            )
            .select('.domain').remove()
            .append('text')
            .attr('transform', 'rotate(-90)');

        svg.selectAll('.tick line').attr('stroke', '#EBEBEB');

        const svgSel = svg.append('g')
            .attr('clip-path', 'url(#offsetClip)');

        drawActualPositionWindow();
        count_width(this.min_date_boundary);
        count_granularity(this.max_date_boundary - this.min_date_boundary);
        drawBars();
        drawFilteredBars();
        // drawZoomNavigation();
        drawSelections();
        this.showAndHideTraces();

        // responsive - keep zoom
        if (this.savedZoomProperties != null) {
            const newX = -(element.offsetWidth * ((this.savedZoomProperties.zoom.x * -1) / this.savedZoomProperties.oldWidth));
            const translateBy = (newX - this.savedZoomProperties.zoom.x) / this.savedZoomProperties.zoom.k;
            d3.select(svg.node()).call(zoom.transform, this.savedZoomProperties.zoom.translate(translateBy, 0));
            // bug: not zooming to the center of view
        }

        // graph_range in days
        function count_granularity(graph_range) {
            if (graph_range < 7) {
                // if (thisClass.granularity_level !== 'hour') {
                //     thisClass.toaster.success(
                //         'Changed graph granularity level to HOURS'
                //     );
                // }
                thisClass.granularity_level = 'hour';
                thisClass.data = thisClass.data_hours;
                thisClass.filteredData = thisClass.filteredDataHours;
                barWidth = hour_width;
            } else if (graph_range >= 7 && graph_range < 1 * 365) {
                // if (thisClass.granularity_level !== 'day') {
                //     thisClass.toaster.success(
                //         'Changed graph granularity level to DAYS'
                //     );
                // }
                thisClass.granularity_level = 'day';
                thisClass.data = thisClass.data_days;
                thisClass.filteredData = thisClass.filteredDataDays;
                barWidth = day_width;
            } else if (graph_range >= 1 * 365 && graph_range < 4 * 365) {
                // if (thisClass.granularity_level !== 'week') {
                //     thisClass.toaster.success(
                //         'Changed graph granularity level to weeks'
                //     );
                // }
                thisClass.granularity_level = 'week';
                thisClass.data = thisClass.data_weeks;
                thisClass.filteredData = thisClass.filteredDataWeeks;
                barWidth = week_width;
            } else {
                if (thisClass.granularity_level !== 'month') {
                    // if (thisClass.granularity_level !== '') {
                    //     thisClass.toaster.success(
                    //         'Changed graph granularity level to months'
                    //     );
                    // }
                    thisClass.granularity_level = 'month';
                }
                thisClass.data = thisClass.data_months;
                thisClass.filteredData = thisClass.filteredDataMonths;
                barWidth = month_width;
            }
        }



        function count_width(param) {
            month_width = actualX(new Date(param).getTime() + 1000 * 30 * 24 * 3600) - actualX(new Date(param).getTime());
            week_width = actualX(new Date(param).getTime() + 1000 * 7 * 24 * 3600) - actualX(new Date(param).getTime());
            day_width = actualX(new Date(param).getTime() + 1000 * 1 * 24 * 3600) - actualX(new Date(param).getTime());
            hour_width = actualX(new Date(param).getTime() + 1000 * 1 * 1 * 3600) - actualX(new Date(param).getTime());
        }

        function countBarWidth(param) {
            switch (new Date(param).getMonth()) {
                // 31 - Jan, March, May, July, August, October, December
                case 0:
                case 2:
                case 4:
                case 6:
                case 7:
                case 9:
                case 11:
                    return barWidthWithMarginsRatio * barWidth * 31 / 30;
                case 1:
                    const year = new Date(param).getFullYear();
                    if (new Date(year, 1, 29).getDate() === 29) {
                        return barWidthWithMarginsRatio * barWidth * 29 / 30;
                    }
                    return barWidthWithMarginsRatio * barWidth * 28 / 30;
                default:
                    return barWidthWithMarginsRatio * barWidth;
            }
        }
        function zoomed() {
            // console.log('zoom');

            // if (shiftKey) {
            //     shift(50);
            //     return;
            // }
            const t = d3.event.transform;
            let range: number[] = x.range().map(t.invertX, t);

            let domain = range.map(x.invert, x);
            actualX = x.copy().domain(domain);

            // if range zoom is out of toleranted boundaries, then restore last valid zoom state
            if (range[1] - actualX(lastDate)  > maxEdgeMargin || actualX(firstDate) - range[0] > maxEdgeMargin) {
                range = lastValidZoomRange;
                d3.event.transform.k = lastValidZoomFactor;
                d3.event.transform.x = lastValidZoomX;
                domain = range.map(x.invert, x);
                actualX = x.copy().domain(domain);
            } else {
                lastValidZoomRange = range;
                lastValidZoomFactor = d3.event.transform.k;
                lastValidZoomX = d3.event.transform.x;
            }

            // // same as above
            // actualX = d3.event.transform.rescaleX(x);

             // update axes with these new boundaries
            xAxis.attr('transform', 'translate(' + margin.left + ',' + (contentHeight + margin.top) + ')')
                .call(d3.axisBottom(actualX));

            drawActualPositionWindow();

            const graph_range = (new Date(domain[1]).getTime() - new Date(domain[0]).getTime()) / (1000 * 60 * 60 * 24);
            count_width(thisClass.min_date_boundary);
            count_granularity(graph_range);
            drawBars();
            drawFilteredBars();

            drawZoomNavigation();
            drawSelections();
            thisClass.showAndHideTraces();

            // save zoom for responsive redraw
            thisClass.savedZoomProperties = {'zoom': d3.zoomTransform(svg.node()),
                'oldWidth': element.offsetWidth, 'oldHeight': element.offsetHeight};
        }

        function shift(shiftValue) {
            const currentZoom = d3.zoomTransform(svg.node()).k;

            const shiftLength = shiftValue / currentZoom;
            if (actualX(firstDate) + shiftLength < maxEdgeMargin && actualX(lastDate) + shiftLength > contentWidth - maxEdgeMargin) {
                zoom.transform(svg, d3.zoomTransform(svg.node()).translate(shiftValue / currentZoom, 0));
            }
        }

        // function zoomIn(zoomRange) {
        //     const area = (zoomRange[1].getTime() - zoomRange[0].getTime());
        //     zoom.scaleTo(svg, (lastDate.getTime() - firstDate.getTime()) / Math.max(1,
        //         (zoomRange[1].getTime() - zoomRange[0].getTime() + (0.2 * area)))
        //     );
        //
        //     shift(-actualX(new Date(zoomRange[0].getTime() - 0.1 * area)));
        //     // console.log(d3.zoomTransform(svg.node()).x, d3.zoomTransform(svg.node()).k);
        // }

        function zoomIn() {
            const selectionStart = thisClass.selections[thisClass.selectedSelectionIndex][0];
            const selectionEnd = thisClass.selections[thisClass.selectedSelectionIndex][1];

            const area = selectionEnd.getTime() - selectionStart.getTime();

            zoom.scaleTo(svg, (lastDate.getTime() - firstDate.getTime()) / Math.max(1,
                (selectionEnd.getTime() - selectionStart.getTime() + (0.2 * area)))
            );

            shift(-actualX(new Date(selectionStart.getTime() - 0.1 * area)));
        }

        function zoomOut() {
            zoom.transform(svg, d3.zoomIdentity);
            thisClass.createChart();
        }

        function zoomPlus() {
            zoom.scaleTo(svg, d3.zoomTransform(svg.node()).k / zoomFactor);
        }

        function zoomMinus() {
            zoom.scaleTo(svg, d3.zoomTransform(svg.node()).k * zoomFactor);
        }

        function removeAllSelections() {
            thisClass.selections = [];
            thisClass.selectedSelectionIndex = -1;
            selectionsReset();
            thisClass.selectionsDebouncer.next(thisClass.selections);
        }

        function selectionsReset() {
            drawSelections();
            drawActualPositionWindow();
        }

        function moveSelectionByDay(index, direction) {
            const millisecondsInDay = 24 * 3600 * 1000;

            if (direction === 'left') {
                const new_selection_start = new Date(thisClass.selections[index][0].getTime() - millisecondsInDay);
                const new_selection_end = new Date(thisClass.selections[index][1].getTime() - millisecondsInDay);
                if (actualX(new_selection_start) >= getClosestLeftSelectionEnd(actualX(thisClass.selections[index][0]))) {
                    thisClass.selections[index][0] = new_selection_start;
                    thisClass.selections[index][1] = new_selection_end;
                }
            } else if (direction === 'right') {
                const new_selection_start = new Date(thisClass.selections[index][0].getTime() + millisecondsInDay);
                const new_selection_end = new Date(thisClass.selections[index][1].getTime() + millisecondsInDay);
                if (actualX(new_selection_end) <= getClosestRightSelectionStart(actualX(thisClass.selections[index][1]))) {
                    thisClass.selections[index][0] = new_selection_start;
                    thisClass.selections[index][1] = new_selection_end;
                }
            } else {
                console.log('error in moveSelectionByDay: ' + direction);
            }

            drawSelections();
            drawActualPositionWindow();
            thisClass.selectionsDebouncer.next(thisClass.selections);
        }

        function countExtensionShift() {
            const millisecondsInDay = 24 * 3600 * 1000;
            let extensionShift = millisecondsInDay;
            switch (thisClass.selectedExtendOption) {
                case 'month':
                    extensionShift *= 30;
                    break;
                case 'week':
                    extensionShift *= 7;
                    break;
                case 'hour':
                    extensionShift /= 24;
                    break;
                case 'day':
                    extensionShift = millisecondsInDay;
                    break;
                default:
                    extensionShift = millisecondsInDay;
                    break;

            }

            return thisClass.extendValue * extensionShift;
        }

        function extendSelectionForth() {
            const extensionShift = countExtensionShift();
            const new_selection_end = new Date(thisClass.selections[thisClass.selectedSelectionIndex][1].getTime() + extensionShift);

            if (actualX(new_selection_end) <= getClosestRightSelectionStart(actualX(thisClass.selections[thisClass.selectedSelectionIndex][1]))) {
                thisClass.selections[thisClass.selectedSelectionIndex][1] = new_selection_end;
            }

            drawSelections();
            drawActualPositionWindow();
            thisClass.selectionsDebouncer.next(thisClass.selections);

        }

        function extendSelectionBack() {
            const extensionShift = countExtensionShift();
            const new_selection_start = new Date(thisClass.selections[thisClass.selectedSelectionIndex][0].getTime() - extensionShift);

            if (actualX(new_selection_start) >= getClosestLeftSelectionEnd(actualX(thisClass.selections[thisClass.selectedSelectionIndex][0]))) {
                thisClass.selections[thisClass.selectedSelectionIndex][0] = new_selection_start;
            }

            drawSelections();
            drawActualPositionWindow();
            thisClass.selectionsDebouncer.next(thisClass.selections);
        }

        function updateBars() {
            // update bars
            g.selectAll('.bar')
                .attr('x', function(d) {return actualX(thisClass.baseService.getDateWithoutOffset(new Date(d[0]))); })
                .attr('width',
                    Math.max(
                        0.9 * (contentWidth / ((actualX.domain()[1].getTime() - actualX.domain()[0].getTime()) / (24 * 3600 * 1000))), 1));
            g.selectAll('.filteredBar')
                .attr('x', function(d) {return actualX(thisClass.baseService.getDateWithoutOffset(new Date(d[0]))); })
                .attr('width',
                    Math.max(
                        0.9 * (contentWidth / ((actualX.domain()[1].getTime() - actualX.domain()[0].getTime()) / (24 * 3600 * 1000))), 1));
        }

        function drawZoomNavigation() {
            svg.selectAll('.zoomNavLeftIcon').remove();
            svg.selectAll('.zoomNavLeft').remove();
            svg.selectAll('.leftShadowBar').remove();
            svg.selectAll('.zoomNavRightIcon').remove();
            svg.selectAll('.zoomNavRight').remove();
            svg.selectAll('.rightShadowBar').remove();
            const currentZoom = d3.zoomTransform(svg.node()).k;
            if (currentZoom !== 1) {
                leftMask.append('rect')
                    .attr('class', 'leftMaskBar')
                    .attr('x', 0)
                    .attr('width', zoomSideShadowWidth)
                    .attr('y', 0)
                    .attr('height', contentHeight)
                    .attr('fill', 'url(#GradientLeft)');
                g.selectAll('.leftShadowBar').remove();
                g.append('rect')
                    .attr('class', 'leftShadowBar')
                    .attr('x', 0)
                    .attr('width', zoomSideShadowWidth)
                    .attr('y', 0)
                    .attr('height', contentHeight)
                    .attr('mask', 'url(#leftShadowMask)')
                    .attr('fill', 'rgba(255, 255, 255, 1)');
                rightMask.append('rect')
                    .attr('class', 'rightMaskBar')
                    .attr('x', contentWidth - zoomSideShadowWidth)
                    .attr('width', zoomSideShadowWidth)
                    .attr('y', 0)
                    .attr('height', contentHeight)
                    .attr('fill', 'url(#GradientRight)');
                g.selectAll('.rightShadowBar').remove();
                g.append('rect')
                    .attr('class', 'rightShadowBar')
                    .attr('x', contentWidth - zoomSideShadowWidth)
                    .attr('width', zoomSideShadowWidth)
                    .attr('y', 0)
                    .attr('height', contentHeight)
                    .attr('mask', 'url(#rightShadowMask)')
                    .attr('fill', 'rgba(255, 255, 255, 1)');

                // left arrow
                svg.selectAll('.zoomNavLeftIcon').remove();
                svg.append('svg:foreignObject')
                    .attr('class', 'zoomNavLeftIcon')
                    .attr('x', 10 + margin.left)
                    .attr('y', (contentHeight / 2) + margin.top - 10)
                    .attr('width', 20)
                    .attr('height', 20)
                    .append('xhtml:span')
                    .attr('class', 'glyphicon glyphicon-chevron-left');
                svg.selectAll('.zoomNavLeft').remove();
                svg.append('rect')
                    .attr('class', 'zoomNavLeft')
                    .attr('x', margin.left)
                    .attr('y', margin.top)
                    .attr('width', zoomSideShadowWidth / 2)
                    .attr('height', contentHeight)
                    .style('fill-opacity', 0)
                    // .style('stroke', '#333333')
                    // .style('stroke-width', 2)
                    .style('cursor', 'pointer')
                    .on('click', function () {
                        d3.event.stopPropagation();
                        shift(50);
                    });

                // right arrow
                svg.selectAll('.zoomNavRightIcon').remove();
                svg.append('svg:foreignObject')
                    .attr('class', 'zoomNavRightIcon')
                    .attr('x', contentWidth - 20 + margin.left)
                    .attr('y', (contentHeight / 2) + margin.top - 10)
                    .attr('width', 20)
                    .attr('height', 20)
                    .append('xhtml:span')
                    .attr('class', 'glyphicon glyphicon-chevron-right');
                svg.selectAll('.zoomNavRight').remove();
                svg.append('rect')
                    .attr('class', 'zoomNavRight')
                    .attr('x', (contentWidth + margin.left) - (zoomSideShadowWidth / 2))
                    .attr('y', margin.top)
                    .attr('width', zoomSideShadowWidth / 2)
                    .attr('height', contentHeight)
                    .style('fill-opacity', 0)
                    // .style('stroke', '#333333')
                    // .style('stroke-width', 2)
                    .style('cursor', 'pointer')
                    .on('click', function () {
                        d3.event.stopPropagation();
                        shift(-50);
                    });
            }
        }

        function drawBars() {
            g.selectAll('.bar').remove();
            for (let i = 0; i < data.length; i++) {
                g.selectAll('.bar' + thisClass.data[i].name)
                    .data(thisClass.data[i].data)
                    .enter()
                    .filter(function(d) {
                        if ((actualX(d[0]) + barWidth < 0) || (actualX(d[0]) - barWidth > contentWidth)) {
                            return false;
                        }
                        return true;
                    })
                    .append('rect')
                    .attr('class', 'bar bar' + data[i].name)
                    .attr('x', function(d) {
                        const localBarWidth = countBarWidth(d[0]);
                        const marginWidthRatio = (1 - barWidthWithMarginsRatio) / 2.0;

                        if (thisClass.granularity_level !== 'hour') {
                            const x_position = new Date(d[0]).setHours(0);
                            return actualX(x_position) + localBarWidth * marginWidthRatio;
                        }
                            return actualX(thisClass.getDateWithoutOffset(new Date(d[0]))) + localBarWidth * marginWidthRatio;
                    })
                    // .attr('y', d => actualY(d[1]))
                    .attr('y', function(d) {
                        if (d[1] < 1) {
                            return 0;
                        } else if (d[1] < 2) {
                            return actualY(2) + ((actualY(1) - actualY(2)) / 2);
                        } else {
                            return actualY(d[1]);
                        }
                    })
                    .attr('width', d => countBarWidth(d[0]))
                    .attr('height', function(d) {
                        if (d[1] < 1) {
                            return 0;
                        } else if (d[1] < 2) {
                            return actualY(1) - actualY(2) - ((actualY(1) - actualY(2)) / 2);
                        } else {
                            return actualY(1) - actualY(d[1]);
                        }
                    })
                    .attr('fill', thisClass.data[i].color)
                    .on('mouseover', function(d) {
                        // const color = d3.rgb(thisClass.data[i].color);
                        // color.opacity = 1.0;
                        // color.r *= 0.7;
                        // color.g *= 0.7;
                        // color.b *= 0.7;
                        const color = 'grey';
                        d3.select(this).style('fill', color.toString());
                        d3.select(this)
                            .style('filter', 'brightness(3)');
                        tooltip
                            // .style('opacity', 1);
                            .style('display', 'inline-block');
                    })
                    .on('mouseout', function() {
                        d3.select(this).style('fill', thisClass.data[i].color);
                        d3.select(this).style('filter', 'brightness(1)');
                        tooltip
                            // .style('opacity', 0);
                            .style('display', 'none');
                    })
                    .on('mousemove', function(d) {
                        const dateString = thisClass.getDateStringForBarTooltip(d[0]);
                        tooltip
                            .html('<p style="display: block; margin: 0; font-size: x-small">' +
                                dateString
                                + '</p>' +
                                '<p style="display: block; margin: 0; font-size: small; font-weight: bold">' +
                                data[i].name + ': ' + d[1] + '</p>')
                            .style('left', actualX(d[0]) + 5 + 'px')
                            .style('border-color', thisClass.data[i].color)
                            .style('margin-top', -25 + 'px');
                            // .style('top', 0 + 'px');
                    }).on('click', function (d) {
                        d3.select(this).transition().style('stroke', 'black');
                        d3.select(this).transition().style('stroke', 'none').delay(2000);
                        thisClass.scrollToBar.emit(new Date(d[0]));
                });
            }
            drawMarks();
        }

        function drawFilteredBars() {
            g.selectAll('.filteredBar').remove();
            if (thisClass.filteredData.length > 0 && thisClass.searchString !== undefined) {
                g.selectAll('.bar').attr('fill', '#cccccc');

                for (let i = 0; i < thisClass.filteredData.length; i++) {
                    g.selectAll('.filteredBar' + thisClass.filteredData[i].name)
                        .data(thisClass.filteredData[i].data)
                        .enter()
                        .filter(function(d) {
                            if ((actualX(d[0]) + barWidth < 0) || (actualX(d[0]) - barWidth > contentWidth)) {
                                return false;
                            }
                            return true;
                        })
                        .append('rect')
                        .attr('class', 'filteredBar filteredBar' + thisClass.filteredData[i].name)
                        // .attr('class', 'bar' + data[i].name)
                        .attr('x', function(d) {
                            const localBarWidth = countBarWidth(d[0]);
                            const marginWidthRatio = (1 - barWidthWithMarginsRatio) / 2.0;

                            if (thisClass.granularity_level !== 'hour') {
                                const x_position = new Date(d[0]).setHours(0);
                                return actualX(x_position) + localBarWidth * marginWidthRatio;
                            }
                            return actualX(thisClass.getDateWithoutOffset(new Date(d[0]))) + localBarWidth * marginWidthRatio;
                        })
                        // .attr('y', d => actualY(d[1]))
                        .attr('y', function(d) {
                            if (d[1] < 1) {
                                return 0;
                            } else if (d[1] < 2) {
                                return actualY(2) + ((actualY(1) - actualY(2)) / 2);
                            } else {
                                return actualY(d[1]);
                            }
                        })
                        .attr('width', d => countBarWidth(d[0]))
                        .attr('height', function(d) {
                            if (d[1] < 1) {
                                return 0;
                            } else if (d[1] < 2) {
                                return actualY(1) - actualY(2) - ((actualY(1) - actualY(2)) / 2);
                            } else {
                                return actualY(1) - actualY(d[1]);
                            }
                        })
                        .attr('fill', thisClass.filteredData[i].color)
                        .on('mouseover', function(d) {
                            d3.select(this)
                                .style('filter', 'brightness(3)');
                            tooltip
                            // .style('opacity', 1);
                                .style('display', 'inline-block');
                        })
                        .on('mouseout', function() {
                            d3.select(this).style('filter', 'brightness(1)');
                            tooltip
                            // .style('opacity', 0);
                                .style('display', 'none');
                        })
                        .on('mousemove', function(d) {
                            const dateString = thisClass.getDateStringForBarTooltip(d[0]);
                            tooltip
                                .html('<p style="display: block; margin: 0; font-size: x-small">' +
                                   dateString
                                    + '</p>' +
                                '<p style="display: block; margin: 0; font-size: x-small; font-weight: bold"> FILTERED: '
                                    + thisClass.searchString + '</p>' +

                                    '<p style="display: block; margin: 0; font-size: small; font-weight: bold">' +
                                    thisClass.filteredData[i].name + ': ' + d[1] + '</p>')
                                .style('left', actualX(d[0]) + 5 + 'px')
                                .style('border-color', thisClass.filteredData[i].color)
                                .style('margin-top', -25 + 'px');
                        })
                        .on('click', function (d) {
                            thisClass.scrollToBar.emit(new Date(d[0]));
                        });
                }
            } else {
                drawBars();
            }
            drawMarks();
        }

        function selectActualArea() {
            thisClass.selections.push([actualX.domain()[0], actualX.domain()[1]]);
            drawSelections();
            thisClass.selectionsDebouncer.next(thisClass.selections);
        }

        function selectSelection() {
            const click_x = d3.mouse(this)[0] - margin.left;
            for (let j = 0; j < thisClass.selections.length; j++) {
                if (click_x > actualX(thisClass.selections[j][0]) && click_x < actualX(thisClass.selections[j][1])) {
                    if (thisClass.selectedSelectionIndex === j) {
                        thisClass.selectedSelectionIndex = -1;
                    } else {
                        thisClass.selectedSelectionIndex = j;
                    }
                    drawSelections();
                    break;
                }
            }
        }

        function removeSelection() {
            console.log('removing selection');
            thisClass.selections.splice(thisClass.selectedSelectionIndex, 1);
            thisClass.selectedSelectionIndex = -1;
            drawSelections();
            thisClass.selectionsDebouncer.next(thisClass.selections);

        }

        function drawSelections() {
            // shadow over whole chart
            g.selectAll('.shadowBar').remove();
            if (thisClass.selections.length > 0) {
                mask.selectAll('.maskShadowBar').remove();
                mask.append('rect')
                    .attr('class', 'maskShadowBar')
                    .attr('x', 0)
                    .attr('width', contentWidth)
                    .attr('y', 0)
                    .attr('height', contentHeight)
                    .attr('fill', 'white');
                mask.selectAll('.maskSelection').remove();
                mask.selectAll('.maskSelection')
                    .data(thisClass.selections)
                    .enter()
                    .append('rect')
                    .attr('class', 'maskSelection')
                    .attr('x', d => actualX(d[0]))
                    .attr('width', function(d) {return actualX(d[1]) - actualX(d[0]); })
                    .attr('y', 0)
                    .attr('height', contentHeight)
                    // .attr('fill', function (d, i) {
                    //     if (i !== thisClass.selectedSelectionIndex) {
                    //         return '#ffff00';
                    //     }
                    //     console.log(d);
                    //     console.log(i);
                    //     return 'red';
                    // })
                    .attr('fill', '#333333')

                    ;
                // .attr('fill', 'rgba(120, 120, 120, 0.1)');

                g.append('rect')
                    .attr('class', 'shadowBar')
                    .attr('x', 0)
                    .attr('width', contentWidth)
                    .attr('y', 0)
                    .attr('height', contentHeight)
                    .attr('mask', 'url(#shadowMask)')
                    .attr('fill', 'rgba(165, 165, 165, 0.3)')
                    //.attr('fill', 'red')
                    // to enable hover we need to change order of elements (mask to the background)
                    .lower();
                    // .on('mouseover', function() {
                    //     svg.selectAll('.selectionZoomInButton').style('visibility', 'visible');
                    //     svg.selectAll('.selectionZoomInButtonIcon').style('visibility', 'visible');
                    //     svg.selectAll('.selectionRemoveButton').style('visibility', 'visible');
                    //     svg.selectAll('.selectionRemoveButtonIcon').style('visibility', 'visible');
                    // })
                    // .on('mouseout', function() {
                    //     svg.selectAll('.selectionZoomInButton').style('visibility', 'hidden');
                    //     svg.selectAll('.selectionZoomInButtonIcon').style('visibility', 'hidden');
                    //     svg.selectAll('.selectionRemoveButton').style('visibility', 'hidden');
                    //     svg.selectAll('.selectionRemoveButtonIcon').style('visibility', 'hidden');
                    // });
            }

            // selection lines
            svgSel.selectAll('.selectionLineLeft').remove();
            svgSel.selectAll('.selectionLineLeft')
                .data(thisClass.selections)
                .enter()
                .append('line')
                .attr('class', 'selectionLineLeft')
                .attr('x1', d => actualX(d[0]) + margin.left)
                .attr('y1', margin.top)
                .attr('x2', d => actualX(d[0]) + margin.left)
                .attr('y2', contentHeight + margin.top)
                .attr('stroke-width', 2)
                // .style('stroke', '#666666')
                .style('stroke', function(d, i) {
                    if (i === thisClass.selectedSelectionIndex) {
                        return 'blue';
                    }
                    return  '#666666';
                })
                .on('mouseover', function(d) {
                    d3.select(this).style('cursor', 'col-resize');
                })
                .on('mouseout', function(d) {
                    d3.select(this).style('cursor', 'col-resize');
                })
                .call(d3.drag()
                    .on('start', function(d, i) {console.log('start drag line'); d3.event.sourceEvent.stopPropagation(); })
                    .on('drag', function(d, i) {
                        d3.event.sourceEvent.stopPropagation();
                        const dragX = d3.event.x - margin.left;
                        if (actualX(d[1]) > dragX) {
                            const closestLeftSelectionEnd = getClosestLeftSelectionEnd(actualX(d[0]));
                            if (actualX(actualX.invert(dragX)) > closestLeftSelectionEnd) {
                                d[0] = actualX.invert(dragX);
                                drawSelections();
                            }
                        } else {
                            // Find start of the closest selection on the right
                            const closestRightSelectionStart = getClosestRightSelectionStart(actualX(d[1]));
                            if (actualX(actualX.invert(dragX)) < closestRightSelectionStart) {
                                d[1] = actualX.invert(dragX);
                                drawSelections();
                            }
                        }
                        thisClass.selectionsDebouncer.next(thisClass.selections);
                    })
                );
            svgSel.selectAll('.selectionLineRight').remove();
            svgSel.selectAll('.selectionLineRight')
                .data(thisClass.selections)
                .enter().append('line')
                .attr('class', 'selectionLineRight')
                .attr('x1', d => actualX(d[1]) + margin.left)
                .attr('y1', margin.top)
                .attr('x2', d => actualX(d[1]) + margin.left)
                .attr('y2', contentHeight + margin.top)
                .attr('stroke-width', 2)
                .style('stroke', function(d, i) {
                    if (i === thisClass.selectedSelectionIndex) {
                        return 'blue';
                    }
                    return  '#666666';
                })
                .on('mouseover', function(d) {
                    d3.select(this).style('cursor', 'col-resize');
                })
                .on('mouseout', function(d) {
                    d3.select(this).style('cursor', 'col-resize');
                })
                .call(d3.drag()
                    .on('start', function(d, i) {console.log('start drag line'); d3.event.sourceEvent.stopPropagation(); })
                    .on('drag', function(d, i) {
                        d3.event.sourceEvent.stopPropagation();
                        const dragX = d3.event.x - margin.left;
                        if (actualX(d[0]) < dragX) {
                            // Find start of the closest selection on the right
                            const closestRightSelectionStart = getClosestRightSelectionStart(actualX(d[1]));
                            if (actualX(actualX.invert(dragX)) < closestRightSelectionStart) {
                                d[1] = actualX.invert(dragX);
                                drawSelections();
                            }
                        } else {
                            // Find end of the closest selection on the left
                            const closestLeftSelectionEnd = getClosestLeftSelectionEnd(actualX(d[0]));
                            if (actualX(actualX.invert(dragX)) > closestLeftSelectionEnd) {
                                d[0] = actualX.invert(dragX);
                                drawSelections();
                            }
                        }
                        thisClass.selectionsDebouncer.next(thisClass.selections);
                    })
                );

            // selection buttons
            // svg.selectAll('.selectionRemoveButton').remove();
            // svg.selectAll('.selectionRemoveButton')
            //     .data(thisClass.selections)
            //     .enter()
            //     .append('circle')
            //     .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionRemoveButton'; })
            //     .attr('cx', d => actualX(d[1]) + 15 + margin.left)
            //     .attr('r', 10)
            //     .attr('cy', 12 + margin.top)
            //     .style('stroke', '#333333')
            //     .style('stroke-width', 2)
            //     .style('cursor', 'pointer')
            //     .style('fill', '#ffffff')
            //     // hidden after init
            //     .style('visibility', 'hidden')
            //     .on('mousedown', function(d, i) {
            //         thisClass.selections.splice(i, 1);
            //         drawSelections();
            //         thisClass.selectionsDebouncer.next(thisClass.selections);
            //     })
            //     .append('title').text('Remove this selection');
            //
            // svg.selectAll('.selectionRemoveButtonIcon').remove();
            // svg.selectAll('.selectionRemoveButtonIcon')
            //     .data(thisClass.selections)
            //     .enter()
            //     .append('svg:foreignObject')
            //     .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionRemoveButtonIcon'; })
            //     .attr('x', d => actualX(d[1]) + 8 + margin.left)
            //     .attr('y', 3 + margin.top)
            //     .attr('width', 20)
            //     .attr('height', 20)
            //     // hidden after init
            //     .style('visibility', 'hidden')
            //     .style('cursor', 'pointer')
            //     .on('mousedown', function(d, i) {
            //         thisClass.selections.splice(i, 1);
            //         drawSelections();
            //         thisClass.selectionsDebouncer.next(thisClass.selections);
            //     })
            //     .append('xhtml:span')
            //     .attr('class', 'glyphicon glyphicon-remove');

            // svg.selectAll('.selectionRemoveButtonIcon')
            //     .append('title').text('Remove this selection');
            //
            // svg.selectAll('.selectionZoomInButton').remove();
            // svg.selectAll('.selectionZoomInButton')
            //     .data(thisClass.selections)
            //     .enter()
            //     .append('circle')
            //     .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionZoomInButton'; })
            //     .attr('cx', d => actualX(d[1]) + 40 + margin.left)
            //     .attr('r', 10)
            //     .attr('cy', 12 + margin.top)
            //     .style('fill', '#ffffff')
            //     .style('stroke', '#333333')
            //     .style('stroke-width', 2)
            //     .style('cursor', 'pointer')
            //     // hidden after init
            //     .style('visibility', 'hidden')
            //     .on('mousedown', function(d, i) {
            //         console.log(d);
            //         zoomIn(d);
            //     })
            //     .append('title').text('Zoom into selection');
            //
            // svg.selectAll('.selectionZoomInButtonIcon').remove();
            // svg.selectAll('.selectionZoomInButtonIcon')
            //     .data(thisClass.selections)
            //     .enter()
            //     .append('svg:foreignObject')
            //     .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionZoomInButtonIcon'; })
            //     .attr('x', d => actualX(d[1]) + 33 + margin.left)
            //     .attr('y', 3 + margin.top)
            //     .attr('width', 20)
            //     .attr('height', 20)
            //     // hidden after init
            //     .style('visibility', 'hidden')
            //     .style('cursor', 'pointer')
            //     .on('mousedown', function(d, i) {
            //         console.log(d);
            //         zoomIn(d);
            //     })
            //     .append('xhtml:span')
            //     .attr('class', 'glyphicon glyphicon-resize-small');
            //
            // svg.selectAll('.selectionZoomInButtonIcon')
            //     .append('title').text('Zoom into selection');
            //
            //
            // svg.selectAll('.selectionMoveRightByDayButton').remove();
            // svg.selectAll('.selectionMoveRightByDayButton')
            //     .data(thisClass.selections)
            //     .enter()
            //     .append('circle')
            //     .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionMoveRightByDayButton'; })
            //     .attr('cx', d => actualX(d[1]) + 15 + margin.left)
            //     .attr('r', 10)
            //     .attr('cy', 39 + margin.top)
            //     .style('fill', '#ffffff')
            //     .style('stroke', '#333333')
            //     .style('stroke-width', 2)
            //     .style('cursor', 'pointer')
            //     // hidden after init
            //     .style('visibility', 'hidden')
            //     .on('mousedown', function(d, i) {
            //         moveSelectionByDay(i, 'right');
            //         thisClass.toaster.success(
            //             'Selection was moved by one day to future'
            //         );
            //     })
            //     .append('title').text('Move Selection to right by Day');
            //
            // svg.selectAll('.selectionMoveRightByDayIcon').remove();
            // svg.selectAll('.selectionMoveRightByDayIcon')
            //     .data(thisClass.selections)
            //     .enter()
            //     .append('svg:foreignObject')
            //     .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionMoveRightByDayIcon'; })
            //     .attr('x', d => actualX(d[1]) + 8 + margin.left)
            //     .attr('y', 30 + margin.top)
            //     .attr('width', 20)
            //     .attr('height', 20)
            //     // hidden after init
            //     .style('visibility', 'hidden')
            //     .style('cursor', 'pointer')
            //     .on('mousedown', function(d, i) {
            //         moveSelectionByDay(i, 'right');
            //         thisClass.toaster.success(
            //             'Selection was moved by one day to future'
            //         );
            //     })
            //     .append('xhtml:span')
            //     .attr('class', 'glyphicon glyphicon-resize-horizontal');
            //
            // svg.selectAll('.selectionMoveRightByDayIcon')
            //     .append('title').text('Move Selection to right by Day');
            //
            // svg.selectAll('.selectionLeftMoveByDayButton').remove();
            // svg.selectAll('.selectionLeftMoveByDayButton')
            //     .data(thisClass.selections)
            //     .enter()
            //     .append('circle')
            //     .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionLeftMoveByDayButton'; })
            //     .attr('cx', d => actualX(d[0]) - 15 + margin.left)
            //     .attr('r', 10)
            //     .attr('cy', 39 + margin.top)
            //     .style('fill', '#ffffff')
            //     .style('stroke', '#333333')
            //     .style('stroke-width', 2)
            //     .style('cursor', 'pointer')
            //     // hidden after init
            //     .style('visibility', 'hidden')
            //     .on('mousedown', function(d, i) {
            //         moveSelectionByDay(i, 'left');
            //         thisClass.toaster.success(
            //             'Selection was moved by one day to past'
            //         );
            //     })
            //     .append('title').text('Move Selection by Day to left');
            //
            // svg.selectAll('.selectionMoveLeftByDayIcon').remove();
            // svg.selectAll('.selectionMoveLeftByDayIcon')
            //     .data(thisClass.selections)
            //     .enter()
            //     .append('svg:foreignObject')
            //     .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionMoveLeftByDayIcon'; })
            //     .attr('x', d => actualX(d[0]) - 22 + margin.left)
            //     .attr('y', 30 + margin.top)
            //     .attr('width', 20)
            //     .attr('height', 20)
            //     // hidden after init
            //     .style('visibility', 'hidden')
            //     .style('cursor', 'pointer')
            //     .on('mousedown', function(d, i) {
            //         moveSelectionByDay(i, 'left');
            //         thisClass.toaster.success(
            //             'Selection was moved by one day to past'
            //         );
            //     })
            //     .append('xhtml:span')
            //     .attr('class', 'glyphicon glyphicon-resize-horizontal');
            //
            // svg.selectAll('.selectionMoveLeftByDayIcon')
            //     .append('title').text('Move Selection by Day to left');
            //
            // svg.selectAll('.selectionExtendToRightByDayButton').remove();
            // svg.selectAll('.selectionExtendTORightByDayButton')
            //     .data(thisClass.selections)
            //     .enter()
            //     .append('circle')
            //     .attr('class', function(d, i) {
            //         return 'selectionHoverArea-' + i + ' selectionHoverArea selectionExtendToRightByDayButton';
            //     })
            //     .attr('cx', d => actualX(d[1]) + 15 + margin.left)
            //     .attr('r', 10)
            //     .attr('cy', 65 + margin.top)
            //     .style('fill', '#ffffff')
            //     .style('stroke', '#333333')
            //     .style('stroke-width', 2)
            //     .style('cursor', 'pointer')
            //     // hidden after init
            //     .style('visibility', 'hidden')
            //     .on('mousedown', function(d, i) {
            //         extendSelectionToRightByDay(i);
            //         thisClass.toaster.success(
            //             'Selection was extended one day to future'
            //         );
            //     })
            //     .append('title').text('Extend Selection to right by Day');
            //
            // svg.selectAll('.selectionExtendToRightByDayIcon').remove();
            // svg.selectAll('.selectionExtendToRightByDayIcon')
            //     .data(thisClass.selections)
            //     .enter()
            //     .append('svg:foreignObject')
            //     .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionExtendToRightByDayIcon'; })
            //     .attr('x', d => actualX(d[1]) + 8 + margin.left)
            //     .attr('y', 56 + margin.top)
            //     .attr('width', 20)
            //     .attr('height', 20)
            //     // hidden after init
            //     .style('visibility', 'hidden')
            //     .style('cursor', 'pointer')
            //     .on('mousedown', function(d, i) {
            //         extendSelectionToRightByDay(i);
            //         thisClass.toaster.success(
            //             'Selection was extended one day to future'
            //         );
            //     })
            //     .append('xhtml:span')
            //     .attr('class', 'glyphicon glyphicon glyphicon-arrow-right');
            //
            // svg.selectAll('.selectionExtendToRightByDayIcon')
            //     .append('title').text('Extend Selection to right by Day');
            //
            // svg.selectAll('.selectionExtendToLeftByDayButton').remove();
            // svg.selectAll('.selectionExtendToLeftByDayButton')
            //     .data(thisClass.selections)
            //     .enter()
            //     .append('circle')
            //     .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionExtendToLeftByDayButton'; })
            //     .attr('cx', d => actualX(d[0]) - 15 + margin.left)
            //     .attr('r', 10)
            //     .attr('cy', 65 + margin.top)
            //     .style('fill', '#ffffff')
            //     .style('stroke', '#333333')
            //     .style('stroke-width', 2)
            //     .style('cursor', 'pointer')
            //     // hidden after init
            //     .style('visibility', 'hidden')
            //     .on('mousedown', function(d, i) {
            //         extendSelectionToLeftByDay(i);
            //         thisClass.toaster.success(
            //             'Selection was extended one day to past'
            //         );
            //     })
            //     .append('title').text('Extend Selection by Day to left');
            //
            // svg.selectAll('.selectionExtendToLeftByDayIcon').remove();
            // svg.selectAll('.selectionExtendToLeftByDayIcon')
            //     .data(thisClass.selections)
            //     .enter()
            //     .append('svg:foreignObject')
            //     .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionExtendToLeftByDayIcon'; })
            //     .attr('x', d => actualX(d[0]) - 22 + margin.left)
            //     .attr('y', 56 + margin.top)
            //     .attr('width', 20)
            //     .attr('height', 20)
            //     // hidden after init
            //     .style('visibility', 'hidden')
            //     .style('cursor', 'pointer')
            //     .on('mousedown', function(d, i) {
            //         extendSelectionToLeftByDay(i);
            //         thisClass.toaster.success(
            //             'Selection was extended one day to past'
            //         );
            //     })
            //     .append('xhtml:span')
            //     .attr('class', 'glyphicon glyphicon glyphicon-arrow-left');
            //
            // svg.selectAll('.selectionExtendToLeftByDayIcon')
            //     .append('title').text('Extend Selection by Day to left');

            // selection border text
            // svg.selectAll('.selectionTextL').remove();
            // svg.selectAll('.selectionTextL')
            //     .data(thisClass.selections)
            //     .enter()
            //     .append('svg:foreignObject')
            //     .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionTextL'; })
            //     .attr('x', function(d) {
            //         const position = actualX(d[0]) - 100 + margin.left;
            //         if (position > 0 || actualX(d[0]) < 0 || actualX(d[0]) > contentWidth) {
            //             return position;
            //         } else {
            //             return 0;
            //         }
            //     })
            //     .attr('y', 0)
            //     .attr('width', 100)
            //     .attr('height', margin.top)
            //     // hidden after init
            //     .style('visibility', 'hidden')
            //     .append('xhtml:span')
            //     // .style('position', 'relative')
            //     // .style('border', '2px solid blue')
            //     .html(function(d) {
            //         const date = thisClass.baseService.getDateWithoutOffset(new Date(d[0]));
            //         return '<p style="display: block; margin: 0; text-align: right; font-size: small">' +
            //             date.getUTCFullYear() + '-' +
            //             (date.getUTCMonth() + 1).toLocaleString('en-US', {minimumIntegerDigits: 2}) +
            //             '-' + date.getUTCDate().toLocaleString('en-US', {minimumIntegerDigits: 2}) +
            //             '</p><p style="display: block; margin: 0; font-size: x-small; text-align: right;">' +
            //             date.getUTCHours().toLocaleString('en-US', {minimumIntegerDigits: 2}) +
            //             ':' + date.getUTCMinutes().toLocaleString('en-US', {minimumIntegerDigits: 2}) +
            //             ':' + date.getUTCSeconds().toLocaleString('en-US', {minimumIntegerDigits: 2}) + '</p>';
            //     });
            // svg.selectAll('.selectionTextR').remove();
            // svg.selectAll('.selectionTextR')
            //     .data(thisClass.selections)
            //     .enter()
            //     .append('svg:foreignObject')
            //     .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionTextR'; })
            //     .attr('x', function(d) {
            //         const position = actualX(d[1]) + margin.left;
            //         if (position + 145 < contentWidth + margin.left + margin.right || actualX(d[1]) < 0 || actualX(d[1]) > contentWidth) {
            //             return position;
            //         } else {
            //             return contentWidth + margin.left + margin.right - 145;
            //         }
            //     })
            //     .attr('y', 0)
            //     .attr('width', 145)
            //     .attr('height', margin.top)
            //     // hidden after init
            //     .style('visibility', 'hidden')
            //     .append('xhtml:input')
            //     .attr('type', 'datetime-local')
            //     // .attr('(keydown.enter)', '\"$event.target.blur();submit();false\"')
            //     .style('border', 'none')
            //     .style('word-wrap', 'normal')
            //     .property('value', function(d) {
            //         return new Date(d[1]).toISOString().split('.')[0];
            //     })
            //     .on('blur', function(d, i) {
            //         const thisElement = this as HTMLInputElement;
            //         d[1] = thisClass.baseService.getDateWithoutOffset(new Date(thisElement.value));
            //         drawSelections();
            //         thisClass.selectionsDebouncer.next(thisClass.selections);
            //     }).on('keypress', function() {
            //     if (d3.event.keyCode === 13) {
            //         // if enter is pressed
            //         d3.event.target.blur();
            //     }
            // });
            // .append('xhtml:span')
            // .html(function(d) {
            //     const date = new Date(d[1]);
            //     const input = dateInputElement.cloneNode(true);
            //     input.value = date.toISOString().split('.')[0];
            //     return input.toString();
            //     // return '<input type="datetime-local" style="display: block" value="' +
            //  date.toISOString().split('.')[0] + '" (change)="console.log(' + date + ')">';
            //     // return '<p style="display: block; margin: 0; font-size: small">' +
            //     //     date.getUTCFullYear() + '-' +
            //     //     (date.getUTCMonth() + 1).toLocaleString('en-US', {minimumIntegerDigits: 2}) +
            //     //     '-' + date.getUTCDate().toLocaleString('en-US', {minimumIntegerDigits: 2}) +
            //     //     '</p><p style="display: block; margin: 0; font-size: x-small;">' +
            //     //     date.getUTCHours().toLocaleString('en-US', {minimumIntegerDigits: 2}) +
            //     //     ':' + date.getUTCMinutes().toLocaleString('en-US', {minimumIntegerDigits: 2}) +
            //     //     ':' + date.getUTCSeconds().toLocaleString('en-US', {minimumIntegerDigits: 2});
            // });

            drawActualPositionWindow();
        }

        function drawMarks() {
            svg.selectAll('.mark').remove();
            svg.selectAll('.mark-stick').remove();
            svg.selectAll('.mark-count').remove();

            const marksInArray = Array.from(thisClass.marks.values());
            //console.log(marksInArray);
            // for (let i = 0; i < thisClass.marks.size; i++) {
            //     marksInArray.push(thisClass.marks[i]);
            // }
            // for (const [key, value] of Object.entries(thisClass.marks)) {
            //     console.log('here');
            //     marksInArray.push(value);
            // }
            // for (let m in thisClass.marks){
            //     console.log(m);
            //     console.log(m[1]);
            // }

            // marksInArray =
            //
            // console.log(marksInArray);
            marksInArray.sort(function(a, b) {
                if (a.timestamp < b.timestamp) {
                    return -1;
                }
                if (a.timestamp > b.timestamp) {
                    return 1;
                }
                return 0;

            });
            //console.log(marksInArray);

            const grouppedMarks = [];

            let i = 0;

            while (i < marksInArray.length) {
                const currentMark = [marksInArray[i], 1];

                while (true) {
                    if (i + 1 >= marksInArray.length) {
                        break;
                    }
                    if ((actualX(new Date(marksInArray[i + 1].timestamp))) - (actualX(new Date(marksInArray[i].timestamp))) < 15) {
                        currentMark[1]++;
                        i++;
                    } else {
                        break;
                    }
                }
                grouppedMarks.push(currentMark);
                i++;

            }
            //     while (i + 1 < marksInArray.length) {
            //         while()
            //     }
            // }
            //
            // for (let i = 0; i < marksInArray.length; i++) {
            //     let count = 1;
            //
            //
            //     while (true) {
            //         const currentMark = [marksInArray[i], count];
            //
            //         if (i + 1 >= marksInArray.length) {
            //             break;
            //         }
            //         if ((actualX(new Date(marksInArray[i + 1].timestamp))) - (actualX(new Date(marksInArray[i].timestamp))) < 12) {
            //             currentMark[1]++;
            //         }
            //         else {
            //             grouppedMarks.push()
            //         }
            //         i++;
            //     }
            //
            //     // if (i + 1 < marksInArray.length) {
            //     //     while ((actualX(new Date(marksInArray[i + 1].timestamp))) - (actualX(new Date(marksInArray[i].timestamp))) < 15 && i < marksInArray.length - 1) {
            //     //         count++;
            //     //         i++;
            //     //     }
            //     // }
            //
            //
            //     grouppedMarks.push(currentMark);
            // }

            if (grouppedMarks.length > 0) {
                svg.selectAll('.mark-stick')
                    .data(grouppedMarks)
                    .enter()
                    .append('rect')
                    .attr('class', 'mark-stick')
                    .attr('x', d => margin.left + actualX(thisClass.getDateWithoutOffset(new Date(d[0].timestamp))))
                    .attr('y', 18)
                    .attr('width', 1)
                    .attr('height', actualY(1) + 10)
                    .style('fill', 'black');

                svg.selectAll('.mark')
                    .data(grouppedMarks)
                    .enter()
                    .append('circle')
                    .attr('class', 'mark')
                    .attr('cx', function (d) {
                        return margin.left + actualX(thisClass.getDateWithoutOffset(new Date(d[0].timestamp)));
                    })
                    .attr('r', 9)
                    .attr('cy', 18)
                    .style('fill', 'white')
                    .style('stroke', 'black')
                    .on('mouseover', function (d) {
                        if (d[1] > 1) {
                            return;
                        }
                        d3.select(this)
                            .style('filter', 'brightness(3)');
                        tooltip
                        // .style('opacity', 1);
                            .style('display', 'inline-block');
                    })
                    .on('mouseout', function () {
                        d3.select(this).style('filter', 'brightness(1)');
                        tooltip
                        // .style('opacity', 0);
                            .style('display', 'none');
                    })
                    .on('mousemove', function (d) {
                        if (d[1] > 1) {
                            return;
                        }
                        tooltip
                            .html('<p style="display: block; margin: 0; font-size: small; font-weight: bold">' +
                                thisClass.getDateWithoutOffset(new Date(d[0].timestamp)).toLocaleString('en-us')
                                // 'en-US',
                                // { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric'}
                                + '</p>' +
                                '<p style="display: block; margin: 0; font-size: small">' +
                                d[0].filename + '</p>')
                            .style('left', actualX(new Date(d[0].timestamp)) + 'px')
                            .style('border-color', 'black')
                            .style('margin-top', -60 + 'px');
                        // .style('top', 0 + 'px');


                    })
                    .on('click', function (d) {
                        if (d[1] > 1) {
                            return;
                        }
                        thisClass.scrollMarkToIndex.emit(d[0].index);
                    })
                    ;

                svg.selectAll('.mark-count')
                    .data(grouppedMarks)
                    .enter()
                    .append('text')
                    .text(function (d) {
                        if (d[1] === 1) {
                            return '';
                        }
                        return d[1];
                    })
                    .attr('class', 'mark-count')
                    .attr('x', function (d) {
                        if (d[1] < 10) {
                            return margin.left + actualX(thisClass.getDateWithoutOffset(new Date(d[0].timestamp))) - 3;
                        } else {
                            return margin.left + actualX(thisClass.getDateWithoutOffset(new Date(d[0].timestamp))) - 5;
                        }
                    })
                    .attr('y', 21)
                    .attr('font-size', '10px');

            }

            // if (thisClass.marks.size > 0) {
            //     svg.selectAll('.mark-stick')
            //         .data(Array.from(thisClass.marks))
            //         .enter()
            //         .append('rect')
            //         .attr('class', 'mark-stick')
            //         .attr('x', d => margin.left + actualX(thisClass.getDateWithoutOffset(new Date(d[1].timestamp))))
            //         .attr('y', 18)
            //         .attr('width', 1)
            //         .attr('height', actualY(1) + 10)
            //         .style('fill', 	'#808080');
            //
            //     svg.selectAll('.mark')
            //         .data(Array.from(thisClass.marks))
            //         .enter()
            //         .append('circle')
            //         .attr('class', 'mark')
            //         .attr('cx', function (d) {
            //             return margin.left + actualX(thisClass.getDateWithoutOffset(new Date(d[1].timestamp)));
            //         })
            //         .attr('r', 6)
            //         .attr('cy', 18)
            //         .style('fill', 'white')
            //         .style('stroke', 'black')
            //         .on('mouseover', function(d) {
            //             d3.select(this)
            //                 .style('filter', 'brightness(3)');
            //             tooltip
            //             // .style('opacity', 1);
            //                 .style('display', 'inline-block');
            //         })
            //         .on('mouseout', function() {
            //             d3.select(this).style('filter', 'brightness(1)');
            //             tooltip
            //             // .style('opacity', 0);
            //                 .style('display', 'none');
            //         })
            //         .on('mousemove', function(d) {
            //             tooltip
            //                 .html('<p style="display: block; margin: 0; font-size: small; font-weight: bold">' +
            //                     thisClass.getDateWithoutOffset(new Date(d[1].timestamp)).toLocaleString('en-us')
            //             // 'en-US',
            //             // { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric'}
            //                     + '</p>' +
            //                     '<p style="display: block; margin: 0; font-size: small">' +
            //                     d[1].filename + '</p>')
            //                 .style('left', actualX(new Date(d[1].timestamp)) + 'px')
            //                 .style('border-color', 'black')
            //                 .style('margin-top', -60 + 'px');
            //             // .style('top', 0 + 'px');
            //
            //
            //         });
            //
            // }
        }


        let dragStartX = null;
        let dragShiftStartX = null;
        function dragStart() {
            if (d3.event.sourceEvent.ctrlKey) {
                dragShiftStartX = null;
                if (d3.event.x - margin.left > 0 && d3.event.x - margin.left < contentWidth) {
                    dragStartX = d3.event.x - margin.left;
                    for (let j = 0; j < thisClass.selections.length; j++) {
                        if (dragStartX > actualX(thisClass.selections[j][0]) && dragStartX < actualX(thisClass.selections[j][1])) {
                            dragStartX = null;
                            return;
                        }
                    }

                    g.selectAll('.dragRect').remove();
                    g.append('rect')
                        .attr('class', 'dragRect')
                        .attr('x', actualX(actualX.invert(dragStartX)))
                        .attr('y', 0)
                        .attr('width', 0)
                        .attr('height', contentHeight)
                        .attr('fill', 'rgba(66, 135, 245, 0.4)');
                } else {
                    dragStartX = null;
                }
            } else {
                svg.style('cursor', 'move');
                dragStartX = null;
                dragShiftStartX = d3.event.x;
            }
        }

        function dragEnd() {
            if (dragShiftStartX != null) {
                svg.style('cursor', 'default');
                dragShiftStartX = null;
            }
            g.selectAll('.dragRect').remove();
            let draggedX = Math.max(0, Math.min(d3.event.x - margin.left, contentWidth));

            // If selection left->right, looking for closest right selection start, if right->left then closest left selection end
            if (dragStartX < draggedX) {
                draggedX = Math.min(getClosestRightSelectionStart(dragStartX), draggedX);
            } else {
                draggedX = Math.max(getClosestLeftSelectionEnd(dragStartX), draggedX);
            }


            // Check if new selection intersect any current selections then return
            for (let i = 0; i < thisClass.selections.length; i++) {
                if (dragStartX < draggedX) {
                    // new left->right selection contain another selection
                    if (dragStartX <= actualX(thisClass.selections[i][0]) && draggedX >= actualX(thisClass.selections[i][1])) {
                        return;
                    }
                    // new left->right selection is in another selection
                    if (dragStartX >= actualX(thisClass.selections[i][0]) && draggedX <= actualX(thisClass.selections[i][1])) {
                        return;
                    }
                } else {
                    // new right->left selection contain another selection
                    if (dragStartX <= actualX(thisClass.selections[i][1]) && draggedX >= actualX(thisClass.selections[i][0])) {
                        return;
                    }
                    // new right->left selection is in another selection
                    if (dragStartX >= actualX(thisClass.selections[i][1]) && draggedX <= actualX(thisClass.selections[i][0])) {
                        return;
                    }
                }
            }

            if (dragStartX != null) {
                if (draggedX - dragStartX !== 0) {
                    if (draggedX < dragStartX) {
                        thisClass.selections.push([actualX.invert(draggedX), actualX.invert(dragStartX)]);
                    } else {
                        thisClass.selections.push([actualX.invert(dragStartX), actualX.invert(draggedX)]);
                    }
                    thisClass.selectionsDebouncer.next(thisClass.selections);
                    // console.log('drag end', draggedX, x(draggedX), d3.mouse(this), thisClass.selections);
                    g.selectAll('.dragRect').remove();
                    drawSelections();
                }
            }
        }

        function dragging() {
            if (d3.event.sourceEvent.ctrlKey) {
                const dragSelectionX = d3.event.x - margin.left;

                // Stops draging to right if get to closest selection
                if (dragStartX < dragSelectionX) {
                    if (dragSelectionX > getClosestRightSelectionStart(dragStartX)) {
                        return;
                    }
                }
                // Stops draging to left if get to closest selection
                if (dragStartX > dragSelectionX) {
                    if (dragSelectionX < getClosestLeftSelectionEnd(dragStartX)) {
                        return;
                    }
                }

                if (dragStartX != null) {
                    if (dragSelectionX - dragStartX < 1) {
                        g.selectAll('.dragRect')
                            .attr('x', actualX(actualX.invert(dragSelectionX)))
                            .attr('width', actualX(actualX.invert(dragStartX - dragSelectionX)));
                    } else {
                        g.selectAll('.dragRect')
                            .attr('x', actualX(actualX.invert(dragStartX)))
                            .attr('width', actualX(actualX.invert(dragSelectionX - dragStartX)));
                    }
                }
            } else {
                const shiftTo = d3.event.x;
                const shiftLength = shiftTo - dragShiftStartX;

                if (actualX(firstDate) + shiftLength < maxEdgeMargin && actualX(lastDate) + shiftLength > contentWidth - maxEdgeMargin) {
                    shift(shiftTo - dragShiftStartX);
                    dragShiftStartX = shiftTo;
                }
            }
        }

        // d3.select(window).on('keydown', function() {
        //     shiftKey = d3.event.shiftKey;
        // });
        //
        // d3.select(window).on('keyup', function() {
        //     shiftKey = d3.event.shiftKey;
        // });

        function drawActualPositionWindow() {
            d3.selectAll('.positionWindowRect').remove();
            d3.selectAll('.positionWindowBar').remove();
            if (thisClass.selections.length > 0) {
                positionWindowClip.selectAll('.positionWindowBar')
                    .data(thisClass.selections)
                    .enter()
                    .append('svg:rect')
                    .attr('class', 'positionWindowBar')
                    .attr('x', function(d) {
                        const xVal = actualX(d[0]) + margin.left;
                        if (xVal < margin.left) {
                            return margin.left;
                        } else if (xVal > (contentWidth + margin.left)) {
                            return contentWidth + margin.left;
                        } else {
                            return xVal;
                        }
                    })
                    .attr('width', function(d) {
                        const xWidth = actualX(d[1]) - actualX(d[0]);
                        const xVal = actualX(d[1]) + margin.left;
                        if (xVal < margin.left) {
                            return 0;
                        } else if (xVal > (contentWidth + margin.left)) {
                            return contentWidth - (actualX(d[0]));
                        } else {
                            return xWidth;
                        }
                    })
                    .attr('y', 0)
                    .attr('height', element.offsetHeight);
            } else {
                positionWindowClip
                    .append('svg:rect')
                    .attr('class', 'positionWindowRect')
                    .attr('width', contentWidth)
                    .attr('height', element.offsetHeight )
                    .attr('x', margin.left)
                    .attr('y',  0);
            }

            svg.selectAll('.actualPositionWindow').remove();
            svg.append('rect')
                .attr('class', 'actualPositionWindow')
                .attr('y', contentHeight + margin.top)
                .attr('height', margin.bottom)
                .attr('x', function () {
                    if (thisClass.windowPosition.from != null) {
                        return actualX(thisClass.windowPosition.from) + margin.left;
                    } else {
                        return 0;
                    }
                })
                .attr('width', function() {
                    if (thisClass.windowPosition.from != null && thisClass.windowPosition.to != null) {
                        return Math.max((actualX(thisClass.windowPosition.to) - actualX(thisClass.windowPosition.from)), 1);
                    } else {
                        return 0;
                    }
                })
                .attr('fill', 'rgba(173, 216, 230, 0.4)')
                .on('click', function() {
                    d3.selectAll('.actualPositionWindow')
                        .attr('x', actualX(thisClass.windowPosition.from) + margin.left)
                        .attr('width', Math.max((actualX(thisClass.windowPosition.to) - actualX(thisClass.windowPosition.from)), 1));
                })
                .lower()
                // .attr('mask', 'url(#rightShadowMask)')
                .attr('clip-path', 'url(#positionWindowClip)');
        }

        function getClosestLeftSelectionEnd(actualSelectionStart) {
            let closestLeftSelectionEnd = Number.NEGATIVE_INFINITY;
            for (let j = 0; j < thisClass.selections.length; j++) {
                if (actualX(thisClass.selections[j][1]) <= actualSelectionStart) {
                    closestLeftSelectionEnd = Math.max(actualX(thisClass.selections[j][1]), closestLeftSelectionEnd);
                }
            }
            return closestLeftSelectionEnd;
        }

        function getClosestRightSelectionStart(actualSelectionEnd) {
            let closestRightSelectionStart = Number.POSITIVE_INFINITY;
            for (let j = 0; j < thisClass.selections.length; j++) {
                if (actualX(thisClass.selections[j][0]) >= actualSelectionEnd) {
                    closestRightSelectionStart = Math.min(actualX(thisClass.selections[j][0]), closestRightSelectionStart);
                }
            }
            return closestRightSelectionStart;
        }
    }

    onResize() {
        this.createChart();
    }

    showAndHideTraces() {
        d3.selectAll('.bar').style('visibility', 'hidden');
        for (const typeName of Array.from(this.selectedTypes)) {
            d3.selectAll('.bar' + typeName).style('visibility', 'visible');
        }
    }

    updatePositionWindow(from: Date, to: Date) {
        this.windowPosition.from = from;
        to.setDate(to.getDate() + 1);
        this.windowPosition.to = to;
        d3.selectAll('.actualPositionWindow').dispatch('click');
    }

    setSelections(selections) {
        this.setSelectionsWithoutEmit(selections);
        this.selectionsEmitter.emit(this.selections);
    }

    private setSelectionsWithoutEmit(selections) {
        this.selections = selections.map(function(val) {return [new Date(val[0]), new Date(val[1])]; });
        d3.selectAll('.resetSelectionsButton').dispatch('click');
    }

    selectedSelectionToString() {
        return [
            // new Date(this.selections[this.selectedSelectionIndex][0]).toISOString().split('.')[0],

            new Date(this.selections[this.selectedSelectionIndex][0]).toLocaleString('en-us'),
            new Date(this.selections[this.selectedSelectionIndex][1]).toLocaleString('en-us')
        ];
    }

    selected() {
        console.log(this.selectedExtendOption);
        console.log(this.extendValue);
    }

    addMark(mark) {
        if (mark.add) {
            this.marks.set(mark.id, mark);
        } else {
            this.marks.delete(mark.id);
        }

        this.selectionsEmitter.emit(this.selections);
    }

    getDateWithoutOffset(date) {
        return new Date(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            date.getUTCHours(),
            date.getUTCMinutes(),
            date.getUTCSeconds(),
            0
        );
    }

    getDateStringForBarTooltip(date) {
        let dateString = '';
        if (this.granularity_level === 'month') {
            dateString = this.getDateWithoutOffset(new Date(date)).toLocaleString('en-US',
                { year: 'numeric', month: 'long'});
        } else if (this.granularity_level === 'week') {
            dateString = this.getDateWithoutOffset(new Date(date)).toLocaleString('en-US',
                { year: 'numeric', month: 'long', day: 'numeric'}) + ' - ' +
                this.getDateWithoutOffset(new Date(date + 1000 * 7 * 24 * 3600)).toLocaleString('en-US',
                    { year: 'numeric', month: 'long', day: 'numeric'});
        } else if (this.granularity_level === 'day') {
            dateString = this.getDateWithoutOffset(new Date(date)).toLocaleString('en-US',
                { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'});
        } else {
            dateString = this.getDateWithoutOffset(new Date(date)).toLocaleString('en-US',
                { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric'});
        }

        return dateString;
    }
}
