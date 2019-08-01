import {AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild} from '@angular/core';
import * as d3 from 'd3';
import {Observable, Subject, Subscription} from 'rxjs';
import {bisect, select} from 'd3';
import {debounceTime} from 'rxjs/operators';
import {Hotkey, HotkeysService} from 'angular2-hotkeys';
import {transformAll} from '@angular/compiler/src/render3/r3_ast';
import {BaseService} from '../../../services/base.service';

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
    data: HistogramData[] = [];
    @Input()
    filteredData: HistogramData[] = [];

    @Input()
    min_date_boundary: any;
    @Input()
    max_date_boundary: any;
    @Input()
    selectedTypes = ['m', 'a', 'c', 'b'];
    windowPosition = {from: null, to: null};

    selections = [];
    @Output() selectionsEmitter = new EventEmitter<any[]>();
    // debouncer is used to emit values once in a time. Solves the problem with a lot of calls to db
    selectionsDebouncer: Subject<any[]> = new Subject();

    margin = { top: 30, right: 40, bottom: 40, left: 50 };
    savedZoomProperties = null;

    private subscriptions: Subscription[] = [];

    constructor(private _hotkeysService: HotkeysService,
                private baseService: BaseService) {
        this.subscriptions.push(this.selectionsDebouncer.pipe(debounceTime(500)).subscribe((value) => this.selectionsEmitter.emit(value)));
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
        // console.log('create graph');

        const thisClass = this;
        const element = this.chartContainer.nativeElement;
        const data = this.data;
        const margin = this.margin;
        const zoomSideShadowWidth = 70;
        const zoomFactor = 0.9;
        const hoverAreaOffset = {left: 20, right: 60};
        // let shiftKey = false;
        // maximum difference between [ first data | last date ] and the edge of the graph, used for boundaries when
        const maxEdgeMargin = 100;



        d3.select(element).select('svg').remove();

        const zoom = d3.zoom()
            .scaleExtent([1, 10000])
            .translateExtent([[0, 0], [element.offsetWidth, element.offsetHeight]])
            .on('zoom', zoomed);

        const drag = d3.drag()
            .on('start', dragStart)
            .on('end', dragEnd)
            .on('drag', dragging);

        const svg = d3.select(element).append('svg')
            .attr('width', element.offsetWidth)
            .attr('height', element.offsetHeight)
            // .on('wheel', wheeled)
            .on('mousemove', function () {
                const xAxisPos = d3.mouse(this)[0] - margin.left;
                d3.selectAll('.selectionHoverArea').style('visibility', 'hidden');
                for (let index = 0; index < thisClass.selections.length; index++) {
                    if (xAxisPos > (actualX(thisClass.selections[index][0]) - hoverAreaOffset.left) &&
                        xAxisPos < (actualX(thisClass.selections[index][1]) + hoverAreaOffset.right)) {
                        d3.selectAll('.selectionHoverArea-' + index).style('visibility', 'visible');
                    }
                }
            })
            .on('mouseleave', function () {
                d3.selectAll('.selectionHoverArea').style('visibility', 'hidden');
            })
            .call(drag)
            .call(zoom);

        // buttons (+ hidden buttons)
        d3.select('.zoomPlusButton').on('click', zoomPlus);
        d3.select('.zoomMinusButton').on('click', zoomMinus);
        d3.select('.resetZoomButton').on('click', zoomOut);
        d3.select('.removeAllSelectionsButton').on('click', removeAllSelections);
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
        const contentHeight = element.offsetHeight - this.margin.top - this.margin.bottom;

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

        for (const dataItem of data) {
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
            const maximum = d3.max(data, d => d.maxValue);

            if (maximum === undefined) {
                // no ticks if no data loaded
                return [];
            }
            const tickvalues = [];

            let tick = 1;
            while (tick <= maximum) {
                tickvalues.push(tick);
                tick *= 10;
            }
            tickvalues.push(tick);

            return tickvalues;
        }

        const y = d3
            .scaleLog()
            .domain([1, countTickValues()[countTickValues().length - 1]])
            .rangeRound([contentHeight, 0])
            .base(10);

        let actualX = x;
        const actualY = y;
        console.log();


        const g = svg.append('g')
            .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')
            .attr('clip-path', 'url(#clip)');
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
        drawBars();
        drawFilteredBars();
        // drawZoomNavigation();
        drawSelections();
        this.showAndHideTraces(this.selectedTypes);

        // responsive - keep zoom
        if (this.savedZoomProperties != null) {
            const newX = -(element.offsetWidth * ((this.savedZoomProperties.zoom.x * -1) / this.savedZoomProperties.oldWidth));
            const translateBy = (newX - this.savedZoomProperties.zoom.x) / this.savedZoomProperties.zoom.k;
            d3.select(svg.node()).call(zoom.transform, this.savedZoomProperties.zoom.translate(translateBy, 0));
            // bug: not zooming to the center of view
        }

        function zoomed() {
            // if (shiftKey) {
            //     shift(50);
            //     return;
            // }
            const t = d3.event.transform;
            const range = x.range().map(t.invertX, t);
            const domain = range.map(x.invert, x);
            actualX = x.copy().domain(domain);

            // // same as above
            // actualX = d3.event.transform.rescaleX(x);

            // update axes with these new boundaries
            xAxis.attr('transform', 'translate(' + margin.left + ',' + (contentHeight + margin.top) + ')')
                .call(d3.axisBottom(actualX));

            drawActualPositionWindow();
            updateBars();
            drawZoomNavigation();
            drawSelections();
            // save zoom for responsive redraw
            thisClass.savedZoomProperties = {'zoom': d3.zoomTransform(svg.node()),
                'oldWidth': element.offsetWidth, 'oldHeight': element.offsetHeight};

        }

        function shift(shiftValue) {
            const currentZoom = d3.zoomTransform(svg.node()).k;
            zoom.transform(svg, d3.zoomTransform(svg.node()).translate(shiftValue / currentZoom, 0));
        }

        function zoomIn(zoomRange) {
            const area = (zoomRange[1].getTime() - zoomRange[0].getTime());
            zoom.scaleTo(svg, (lastDate.getTime() - firstDate.getTime()) / Math.max(1,
                (zoomRange[1].getTime() - zoomRange[0].getTime() + (0.2 * area)))
            );

            shift(-actualX(new Date(zoomRange[0].getTime() - 0.1 * area)));
            // console.log(d3.zoomTransform(svg.node()).x, d3.zoomTransform(svg.node()).k);
        }

        function zoomOut() {
            zoom.transform(svg, d3.zoomIdentity);
        }

        function zoomPlus() {
            zoom.scaleTo(svg, d3.zoomTransform(svg.node()).k / zoomFactor);
        }

        function zoomMinus() {
            zoom.scaleTo(svg, d3.zoomTransform(svg.node()).k * zoomFactor);
        }

        function removeAllSelections() {
            thisClass.selections = [];
            selectionsReset();
        }

        function selectionsReset() {
            drawSelections();
            drawActualPositionWindow();
            thisClass.selectionsDebouncer.next(thisClass.selections);
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

        function extendSelectionToRightByDay(index) {
            const millisecondsInDay = 24 * 3600 * 1000;

            const new_selection_end = new Date(thisClass.selections[index][1].getTime() + millisecondsInDay);

            if (actualX(new_selection_end) <= getClosestRightSelectionStart(actualX(thisClass.selections[index][1]))) {
                thisClass.selections[index][1] = new_selection_end;
            }

            drawSelections();
            drawActualPositionWindow();
            thisClass.selectionsDebouncer.next(thisClass.selections);
        }

        function extendSelectionToLeftByDay(index) {
            const millisecondsInDay = 24 * 3600 * 1000;

            const new_selection_start = new Date(thisClass.selections[index][0].getTime() - millisecondsInDay);

            if (actualX(new_selection_start) >= getClosestLeftSelectionEnd(actualX(thisClass.selections[index][0]))) {
                thisClass.selections[index][0] = new_selection_start;
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
                g.selectAll('.bar' + data[i].name)
                    .data(data[i].data)
                    .enter().append('rect')
                    .attr('class', 'bar bar' + data[i].name)
                    // .attr('class', 'bar' + data[i].name)
                    .attr('x', d => actualX(thisClass.baseService.getDateWithoutOffset(new Date(d[0]))))
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
                    // .attr('width', contentWidth / data[i].data.length)
                    .attr('width',
                        Math.max(
                            0.9 * (contentWidth / ((actualX.domain()[1].getTime() - actualX.domain()[0].getTime())
                            / (24 * 3600 * 1000))), 1))
                    .attr('height', function(d) {
                        if (d[1] < 1) {
                            return 0;
                        } else if (d[1] < 2) {
                            return actualY(1) - actualY(2) - ((actualY(1) - actualY(2)) / 2);
                        } else {
                            return actualY(1) - actualY(d[1]);
                        }
                    })
                    .attr('fill', data[i].color)
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
                        tooltip
                            .html('<p style="display: block; margin: 0; font-size: x-small">' +
                                new Date(d[0]).toLocaleString('en-US',
                                    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                                + '</p>' +
                                '<p style="display: block; margin: 0; font-size: small; font-weight: bold">' +
                                data[i].name + ': ' + d[1] + '</p>')
                            .style('left', actualX(d[0]) + 5 + 'px')
                            .style('border-color', data[i].color)
                            .style('margin-top', -25 + 'px');
                            // .style('top', 0 + 'px');
                    });
                    // .append('title').text(d => '' + data[i].name + ' - ' + new Date(d[0]).toISOString() + ' - ' + d[1]);
            }
        }

        function drawFilteredBars() {
            g.selectAll('.filteredBar').remove();
            if (thisClass.filteredData.length > 0) {
                g.selectAll('.bar').attr('fill', '#cccccc');

                for (let i = 0; i < thisClass.filteredData.length; i++) {
                    g.selectAll('.filteredBar' + thisClass.filteredData[i].name)
                        .data(thisClass.filteredData[i].data)
                        .enter().append('rect')
                        .attr('class', 'filteredBar filteredBar' + data[i].name)
                        // .attr('class', 'bar' + data[i].name)
                        .attr('x', d => actualX(thisClass.baseService.getDateWithoutOffset(new Date(d[0]))))
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
                        // .attr('width', contentWidth / data[i].data.length)
                        .attr('width',
                            Math.max(
                                0.9 * (contentWidth / ((actualX.domain()[1].getTime() - actualX.domain()[0].getTime())
                                / (24 * 3600 * 1000))), 1))
                        .attr('height', function(d) {
                            if (d[1] < 1) {
                                return 0;
                            } else if (d[1] < 2) {
                                return actualY(1) - actualY(2) - ((actualY(1) - actualY(2)) / 2);
                            } else {
                                return actualY(1) - actualY(d[1]);
                            }
                        })
                        .attr('fill', data[i].color)
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
                            tooltip
                                .html('<p style="display: block; margin: 0; font-size: x-small">' +
                                    new Date(d[0]).toLocaleString('en-US',
                                        { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                                    + '</p>' +
                                    '<p style="display: block; margin: 0; font-size: small; font-weight: bold">' +
                                    data[i].name + ': ' + d[1] + '</p>')
                                .style('left', actualX(d[0]) + 5 + 'px')
                                .style('border-color', data[i].color)
                                .style('margin-top', -25 + 'px');
                            // .style('top', 0 + 'px');
                        });
                    // .append('title').text(d => '' + data[i].name + ' - ' + new Date(d[0]).toISOString() + ' - ' + d[1]);
                }
            }
        }

        function selectActualArea() {
            thisClass.selections.push([actualX.domain()[0], actualX.domain()[1]]);
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
                    .attr('fill', '#333333');
                // .attr('fill', 'rgba(120, 120, 120, 0.1)');

                g.append('rect')
                    .attr('class', 'shadowBar')
                    .attr('x', 0)
                    .attr('width', contentWidth)
                    .attr('y', 0)
                    .attr('height', contentHeight)
                    .attr('mask', 'url(#shadowMask)')
                    .attr('fill', 'rgba(165, 165, 165, 0.3)')
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
                .style('stroke', '#666666')
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
                .style('stroke', '#666666')
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
            svg.selectAll('.selectionRemoveButtonIcon').remove();
            svg.selectAll('.selectionRemoveButtonIcon')
                .data(thisClass.selections)
                .enter()
                .append('svg:foreignObject')
                .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionRemoveButtonIcon'; })
                .attr('x', d => actualX(d[1]) + 8 + margin.left)
                .attr('y', 3 + margin.top)
                .attr('width', 20)
                .attr('height', 20)
                // hidden after init
                .style('visibility', 'hidden')
                .append('xhtml:span')
                .attr('class', 'glyphicon glyphicon-remove');

            svg.selectAll('.selectionRemoveButton').remove();
            svg.selectAll('.selectionRemoveButton')
                .data(thisClass.selections)
                .enter()
                .append('circle')
                .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionRemoveButton'; })
                .attr('cx', d => actualX(d[1]) + 15 + margin.left)
                .attr('r', 10)
                .attr('cy', 12 + margin.top)
                .style('fill-opacity', 0)
                .style('stroke', '#333333')
                .style('stroke-width', 2)
                .style('cursor', 'pointer')
                // hidden after init
                .style('visibility', 'hidden')
                .on('click', function(d, i) {
                    thisClass.selections.splice(i, 1);
                    drawSelections();
                    thisClass.selectionsDebouncer.next(thisClass.selections);
                })
                .append('title').text('Remove this selection');

            svg.selectAll('.selectionZoomInButtonIcon').remove();
            svg.selectAll('.selectionZoomInButtonIcon')
                .data(thisClass.selections)
                .enter()
                .append('svg:foreignObject')
                .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionZoomInButtonIcon'; })
                .attr('x', d => actualX(d[1]) + 33 + margin.left)
                .attr('y', 3 + margin.top)
                .attr('width', 20)
                .attr('height', 20)
                // hidden after init
                .style('visibility', 'hidden')
                .append('xhtml:span')
                .attr('class', 'glyphicon glyphicon-resize-small');

            svg.selectAll('.selectionZoomInButton').remove();
            svg.selectAll('.selectionZoomInButton')
                .data(thisClass.selections)
                .enter()
                .append('circle')
                .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionZoomInButton'; })
                .attr('cx', d => actualX(d[1]) + 40 + margin.left)
                .attr('r', 10)
                .attr('cy', 12 + margin.top)
                .style('fill-opacity', 0)
                .style('stroke', '#333333')
                .style('stroke-width', 2)
                .style('cursor', 'pointer')
                // hidden after init
                .style('visibility', 'hidden')
                .on('click', function(d, i) {
                    zoomIn(d);
                })
                .append('title').text('Zoom into selection');

            svg.selectAll('.selectionMoveRightByDayIcon').remove();
            svg.selectAll('.selectionMoveRightByDayIcon')
                .data(thisClass.selections)
                .enter()
                .append('svg:foreignObject')
                .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionMoveRightByDayIcon'; })
                .attr('x', d => actualX(d[1]) + 8 + margin.left)
                .attr('y', 30 + margin.top)
                .attr('width', 20)
                .attr('height', 20)
                // hidden after init
                .style('visibility', 'hidden')
                .append('xhtml:span')
                .attr('class', 'glyphicon glyphicon-resize-horizontal');

            svg.selectAll('.selectionMoveRightByDayButton').remove();
            svg.selectAll('.selectionMoveRightByDayButton')
                .data(thisClass.selections)
                .enter()
                .append('circle')
                .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionMoveRightByDayButton'; })
                .attr('cx', d => actualX(d[1]) + 15 + margin.left)
                .attr('r', 10)
                .attr('cy', 39 + margin.top)
                .style('fill-opacity', 0)
                .style('stroke', '#333333')
                .style('stroke-width', 2)
                .style('cursor', 'pointer')
                // hidden after init
                .style('visibility', 'hidden')
                .on('click', function(d, i) {
                    moveSelectionByDay(i, 'right');
                })
                .append('title').text('Move Selection to right by Day');

            svg.selectAll('.selectionMoveLeftByDayIcon').remove();
            svg.selectAll('.selectionMoveLeftByDayIcon')
                .data(thisClass.selections)
                .enter()
                .append('svg:foreignObject')
                .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionMoveLeftByDayIcon'; })
                .attr('x', d => actualX(d[0]) - 22 + margin.left)
                .attr('y', 30 + margin.top)
                .attr('width', 20)
                .attr('height', 20)
                // hidden after init
                .style('visibility', 'hidden')
                .append('xhtml:span')
                .attr('class', 'glyphicon glyphicon-resize-horizontal');

            svg.selectAll('.selectionLeftMoveByDayButton').remove();
            svg.selectAll('.selectionLeftMoveByDayButton')
                .data(thisClass.selections)
                .enter()
                .append('circle')
                .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionLeftMoveByDayButton'; })
                .attr('cx', d => actualX(d[0]) - 15 + margin.left)
                .attr('r', 10)
                .attr('cy', 39 + margin.top)
                .style('fill-opacity', 0)
                .style('stroke', '#333333')
                .style('stroke-width', 2)
                .style('cursor', 'pointer')
                // hidden after init
                .style('visibility', 'hidden')
                .on('click', function(d, i) {
                    moveSelectionByDay(i, 'left');
                })
                .append('title').text('Move Selection by Day to left');

            svg.selectAll('.selectionExtendToRightByDayIcon').remove();
            svg.selectAll('.selectionExtendToightByDayIcon')
                .data(thisClass.selections)
                .enter()
                .append('svg:foreignObject')
                .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionExtendToRightByDayIcon'; })
                .attr('x', d => actualX(d[1]) + 8 + margin.left)
                .attr('y', 56 + margin.top)
                .attr('width', 20)
                .attr('height', 20)
                // hidden after init
                .style('visibility', 'hidden')
                .append('xhtml:span')
                .attr('class', 'glyphicon glyphicon glyphicon-arrow-right');

            svg.selectAll('.selectionExtendToRightByDayButton').remove();
            svg.selectAll('.selectionExtendTORightByDayButton')
                .data(thisClass.selections)
                .enter()
                .append('circle')
                .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionExtendToRightByDayButton'; })
                .attr('cx', d => actualX(d[1]) + 15 + margin.left)
                .attr('r', 10)
                .attr('cy', 65 + margin.top)
                .style('fill-opacity', 0)
                .style('stroke', '#333333')
                .style('stroke-width', 2)
                .style('cursor', 'pointer')
                // hidden after init
                .style('visibility', 'hidden')
                .on('click', function(d, i) {
                    extendSelectionToRightByDay(i);
                })
                .append('title').text('Extend Selection to right by Day');

            svg.selectAll('.selectionExtendToLeftByDayIcon').remove();
            svg.selectAll('.selectionExtendToLeftByDayIcon')
                .data(thisClass.selections)
                .enter()
                .append('svg:foreignObject')
                .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionExtendToLeftByDayIcon'; })
                .attr('x', d => actualX(d[0]) - 22 + margin.left)
                .attr('y', 56 + margin.top)
                .attr('width', 20)
                .attr('height', 20)
                // hidden after init
                .style('visibility', 'hidden')
                .append('xhtml:span')
                .attr('class', 'glyphicon glyphicon glyphicon-arrow-left');

            svg.selectAll('.selectionExtendToLeftByDayButton').remove();
            svg.selectAll('.selectionExtendToLeftByDayButton')
                .data(thisClass.selections)
                .enter()
                .append('circle')
                .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionExtendToLeftByDayButton'; })
                .attr('cx', d => actualX(d[0]) - 15 + margin.left)
                .attr('r', 10)
                .attr('cy', 65 + margin.top)
                .style('fill-opacity', 0)
                .style('stroke', '#333333')
                .style('stroke-width', 2)
                .style('cursor', 'pointer')
                // hidden after init
                .style('visibility', 'hidden')
                .on('click', function(d, i) {
                    extendSelectionToLeftByDay(i);
                })
                .append('title').text('Extend Selection by Day to left');

            // selection border text
            svg.selectAll('.selectionTextL').remove();
            svg.selectAll('.selectionTextL')
                .data(thisClass.selections)
                .enter()
                .append('svg:foreignObject')
                .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionTextL'; })
                .attr('x', function(d) {
                    const position = actualX(d[0]) - 100 + margin.left;
                    if (position > 0 || actualX(d[0]) < 0 || actualX(d[0]) > contentWidth) {
                        return position;
                    } else {
                        return 0;
                    }
                })
                .attr('y', 0)
                .attr('width', 100)
                .attr('height', margin.top)
                // hidden after init
                .style('visibility', 'hidden')
                .append('xhtml:span')
                // .style('position', 'relative')
                // .style('border', '2px solid blue')
                .html(function(d) {
                    const date = thisClass.baseService.getDateWithoutOffset(new Date(d[0]));
                    return '<p style="display: block; margin: 0; text-align: right; font-size: small">' +
                        date.getUTCFullYear() + '-' +
                        (date.getUTCMonth() + 1).toLocaleString('en-US', {minimumIntegerDigits: 2}) +
                        '-' + date.getUTCDate().toLocaleString('en-US', {minimumIntegerDigits: 2}) +
                        '</p><p style="display: block; margin: 0; font-size: x-small; text-align: right;">' +
                        date.getUTCHours().toLocaleString('en-US', {minimumIntegerDigits: 2}) +
                        ':' + date.getUTCMinutes().toLocaleString('en-US', {minimumIntegerDigits: 2}) +
                        ':' + date.getUTCSeconds().toLocaleString('en-US', {minimumIntegerDigits: 2}) + '</p>';
                });
            svg.selectAll('.selectionTextR').remove();
            svg.selectAll('.selectionTextR')
                .data(thisClass.selections)
                .enter()
                .append('svg:foreignObject')
                .attr('class', function(d, i) {return 'selectionHoverArea-' + i + ' selectionHoverArea selectionTextR'; })
                .attr('x', function(d) {
                    const position = actualX(d[1]) + margin.left;
                    if (position + 145 < contentWidth + margin.left + margin.right || actualX(d[1]) < 0 || actualX(d[1]) > contentWidth) {
                        return position;
                    } else {
                        return contentWidth + margin.left + margin.right - 145;
                    }
                })
                .attr('y', 0)
                .attr('width', 145)
                .attr('height', margin.top)
                // hidden after init
                .style('visibility', 'hidden')
                .append('xhtml:input')
                .attr('type', 'datetime-local')
                // .attr('(keydown.enter)', '\"$event.target.blur();submit();false\"')
                .style('border', 'none')
                .style('word-wrap', 'normal')
                .property('value', function(d) {
                    return new Date(d[1]).toISOString().split('.')[0];
                })
                .on('blur', function(d, i) {
                    const thisElement = this as HTMLInputElement;
                    d[1] = thisClass.baseService.getDateWithoutOffset(new Date(thisElement.value));
                    drawSelections();
                    thisClass.selectionsDebouncer.next(thisClass.selections);
                }).on('keypress', function() {
                if (d3.event.keyCode === 13) {
                    // if enter is pressed
                    d3.event.target.blur();
                }
            });
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

        let dragStartX = null;
        let dragShiftStartX = null;
        function dragStart() {
            if (d3.event.sourceEvent.ctrlKey) {
                dragShiftStartX = null;
                if (d3.event.x - margin.left > 0 && d3.event.x - margin.left < contentWidth) {
                    dragStartX = d3.event.x - margin.left;
                    for (let j = 0; j < thisClass.selections.length; j++) {
                        if (dragStartX > actualX(thisClass.selections[j][0]) && dragStartX < actualX(thisClass.selections[j][1])) {
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

    showAndHideTraces(types: string[]) {
        this.selectedTypes = types;
        d3.selectAll('.bar').style('visibility', 'hidden');
        for (const typeName of types) {
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
        d3.select('.removeAllSelectionsButton').dispatch('click');
        this.selections = selections;
        d3.selectAll('.resetSelectionsButton').dispatch('click');
        this.selectionsEmitter.emit(this.selections);
    }
}
