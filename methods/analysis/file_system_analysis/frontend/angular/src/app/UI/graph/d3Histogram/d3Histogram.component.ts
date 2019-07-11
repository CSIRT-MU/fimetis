import {AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild} from '@angular/core';
import * as d3 from 'd3';
import {Observable, Subject, Subscription} from 'rxjs';
import {bisect, select} from 'd3';
import {debounceTime} from 'rxjs/operators';
import {Hotkey, HotkeysService} from 'angular2-hotkeys';

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

    @ViewChild('chart')
    private chartContainer: ElementRef;

    @Input()
    data: HistogramData[] = [];

    @Input()
    min_date_boundary = null;
    @Input()
    max_date_boundary = null;

    selections = [];
    @Output() selectionsEmitter = new EventEmitter<any[]>();
    // debouncer is used to emit values once in a time. Solves the problem with a lot of calls to db
    selectionsDebouncer: Subject<any[]> = new Subject();

    margin = { top: 30, right: 20, bottom: 40, left: 50 };

    private subscriptions: Subscription[] = [];

    constructor(private _hotkeysService: HotkeysService) {
        this.subscriptions.push(this.selectionsDebouncer.pipe(debounceTime(500)).subscribe((value) => this.selectionsEmitter.emit(value)));
        this._hotkeysService.add(new Hotkey(['ctrl+right', 'command+right'], (event: KeyboardEvent): boolean => {
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
    }

    ngOnDestroy() {
        this.subscriptions.forEach(subscription => subscription.unsubscribe());
    }

    createChart() {
        console.log('create graph');

        const thisClass = this;
        const element = this.chartContainer.nativeElement;
        const data = this.data;
        const margin = this.margin;
        const zoomSideShadowWidth = 70;
        const selections = this.selections;
        // let xShiftValue = 0;

        // const zoom = d3.zoom()
        //     .scaleExtent([.5, 20])  // This control how much you can unzoom (x0.5) and zoom (x20)
        //     .extent([[0, 0], [contentWidth, contentHeight]])
        //     .on('zoom', updateChart);

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
            .call(drag)
            .call(zoom);
            // .call(d3.zoom().on("zoom", function () {
            //     svg.attr("transform", d3.event.transform)
            // }));

        d3.select('.resetZoomButton').on('click', zoomOut);

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

        // let firstDate: Date = null;
        // let lastDate: Date = null;

        // for (let i = 0; i < data.length; i++) {
        //     if (firstDate == null) {
        //         console.log(data);
        //         firstDate = new Date(data[i].data[0][0]);
        //     } else {
        //         if (new Date(data[i].data[0][0]) < firstDate) {
        //             firstDate = new Date(data[i].data[0][0]);
        //         }
        //     }
        //     if (lastDate == null) {
        //         lastDate = new Date(data[i].data[data[i].data.length - 1][0]);
        //     } else {
        //         if (new Date(data[i].data[data[i].data.length - 1][0]) > lastDate) {
        //             lastDate = new Date(data[i].data[data[i].data.length - 1][0]);
        //         }
        //     }
        //
        // }

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

        const y = d3
            .scaleLog()
            .domain([1, d3.max(data, d => d.maxValue)])
            .rangeRound([contentHeight, 0])
            .base(10);

        let actualX = x;
        const actualY = y;

        // const x = d3
        //     .scaleBand()
        //     .rangeRound([0, contentWidth])
        //     .padding(0.1)
        //     .domain(data[i].dates);
        //
        // const y = d3
        //     .scaleLinear()
        //     .rangeRound([contentHeight, 0])
        //     .domain([0, d3.max(data[i].values, d => d.value)]);

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
                .ticks(3)
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
            // .attr('y', 6)
            // .attr('dy', '0.71em')
            // .attr('text-anchor', 'end')
            // .text('Value');

        svg.selectAll('.tick line').attr('stroke', '#EBEBEB');

        const svgSel = svg.append('g')
            .attr('clip-path', 'url(#offsetClip)');
        drawBars();
        // drawZoomNavigation();
        drawSelections();


        function zoomed() {

            // const t = d3.event.transform;
            // g.attr('transform', t);



            const t = d3.event.transform;

            // dont allow to zoom out of borders

            // if (x(t.invertX(0)) > x(firstDate)) {
            //     t.x = x(firstDate) * t.k;
            // }
            // else if (x(t.invertX(contentWidth)) < x(lastDate)) {
            //     t.x = contentWidth - x(lastDate) * t.k;
            // }

            const range = x.range().map(t.invertX, t);
            const domain = range.map(x.invert, x);
            actualX = x.copy().domain(domain);

            // // recover the new scale

            // actualX = d3.event.transform.rescaleX(x);
            // const currentTransform = d3.zoomTransform(svg.node());
            // if (currentTransform.x > x(lastDate)) {
            //
            // }
            // actualX.domain([actualX.invert(actualX(actualX.domain()[0]) + xShiftValue), actualX.invert(actualX(actualX.domain()[1]) + xShiftValue)]);
            // const newY = d3.event.transform.rescaleY(y);

            // console.log(d3.event.scale, d3.event.translate);
            // actualX = newX;

            // console.log(newX.domain());
            // console.log('zoomed', firstDate.getTime() !== newX.domain()[0].getTime() && lastDate.getTime() !== newX.domain()[1].getTime());

            // update axes with these new boundaries
            xAxis.attr('transform', 'translate(' + margin.left + ',' + (contentHeight + margin.top) + ')')
                .call(d3.axisBottom(actualX));
            // yAxis.call(d3.axisLeft(newY));

            // g.attr('transform', d3.event.transform.x);

            // update bars
            // g.selectAll('.bar')
            //     .attr('x', function(d) {return newX(new Date(d[0])); })
            //     .attr('width', Math.max(contentWidth / ((newX.domain()[1].getTime() - newX.domain()[0].getTime()) / (24 * 3600 * 1000)), 1));
                // .attr('y', function(d) { if (newY(d[1]) < 0) { return 0; } else { return newY(d[1]); }});


            // g.selectAll('.selection')
            //     .attr('x', function(d) {return newX(d[0]); })
            //     .attr('width', function(d) {return newX(d[1]) - newX(d[0]); });
            //
            // g.selectAll('.selectionLineLeft')
            //     .attr('x1', d => newX(d[0]))
            //     .attr('x2', d => newX(d[0]));
            //
            // g.selectAll('.selectionLineRight')
            //     .attr('x1', d => newX(d[1]))
            //     .attr('x2', d => newX(d[1]));

            updateBars();
            drawZoomNavigation();
            // drawBars();
            drawSelections();
        }

        function shift(shiftValue) {
            const currentZoom = d3.zoomTransform(svg.node()).k;
            // console.log(d3.zoomTransform(svg.node()).k);
            // zoom.translateTo([actualX.invert(actualX(actualX.domain()[0]) + shiftValue), actualX.invert(actualX(actualX.domain()[1]) + shiftValue)]);
            // actualX = d3.event.transform.rescaleX(x);
            zoom.transform(svg, d3.zoomTransform(svg.node()).translate(shiftValue / currentZoom, 0));
            // actualX.domain([actualX.invert(actualX(actualX.domain()[0]) + shiftValue), actualX.invert(actualX(actualX.domain()[1]) + shiftValue)]);
            // // xAxis.transition().duration(1000).call(d3.axisBottom(actualX));
            // xAxis.call(d3.axisBottom(actualX));
            // xShiftValue += shiftValue;

            // updateBars();
            // drawZoomNavigation();
            // drawSelections();
        }

        function zoomIn(zoomValue) {
            const area = (zoomValue[1].getTime() - zoomValue[0].getTime());

            // console.log('position', x(zoomValue[0]), x(zoomValue[1]), x(zoomValue[0]) + ((x(zoomValue[1]) - x(zoomValue[0])) / 2));
            // console.log('scale', contentWidth / (x(zoomValue[1]) - x(zoomValue[0]) + (0.4 * (x(zoomValue[1]) - x(zoomValue[0])))), contentWidth, (x(zoomValue[1]) - x(zoomValue[0]) + (0.4 * (x(zoomValue[1]) - x(zoomValue[0])))));

            // fixed to compare time between first - last date and selected area -- better results (not infinity / 0)
            // zoom.scaleTo(svg, contentWidth / Math.max(1, (x(zoomValue[1]) - x(zoomValue[0]) + (0.4 * (x(zoomValue[1]) - x(zoomValue[0]))))));


            zoom.scaleTo(svg, (lastDate.getTime() - firstDate.getTime()) / Math.max(1,
                (zoomValue[1].getTime() - zoomValue[0].getTime() + (0.2 * area)))
            );
            // zoom.translateTo(svg, x(zoomValue[1]), 0);
            // zoom.transform(svg, d3.zoomTransform(svg.node()).scale(contentWidth / (x(zoomValue[1]) - x(zoomValue[0]) + 80 )));
            // zoom.transform(svg, d3.zoomTransform(svg.node()).scale(contentWidth / (x(zoomValue[1]) - x(zoomValue[0]))).translate(-actualX(zoomValue[0]), 0));

            // const zoomTo = new Date(zoomValue[0].getTime() + ((zoomValue[1].getTime() - zoomValue[0].getTime()) / 2));
            // console.log(zoomTo);
            // zoom.translateTo(svg, x(zoomValue[0]) + ((x(zoomValue[1]) - x(zoomValue[0])) / 2), 0);
            // zoom.translateTo(svg, actualX(zoomTo), 0);

            shift(-actualX(new Date(zoomValue[0].getTime() - 0.1 * area)));
            console.log(d3.zoomTransform(svg.node()).x, d3.zoomTransform(svg.node()).k);

            // const currentZoom = d3.zoomTransform(svg.node());
            // const currentZoomX = d3.zoomTransform(svg.node()).x;
            // const zoomShift = x(zoomValue[0]) + currentZoomX;
            //
            // console.log(currentZoom, x(zoomValue[0]));
            // // shift(zoomShift);
            // zoom.transform(svg, d3.zoomTransform(svg.node()).translate(-zoomShift * currentZoom.k, 0));
            // console.log(d3.zoomTransform(svg.node()));

            // updateBars();
            // drawZoomNavigation();
            // drawSelections();
        }

        function zoomOut() {
            zoom.transform(svg, d3.zoomIdentity);
        }

        function updateBars() {
            // update bars
            g.selectAll('.bar')
                .attr('x', function(d) {return actualX(new Date(d[0])); })
                .attr('width', Math.max(0.9 * (contentWidth / ((actualX.domain()[1].getTime() - actualX.domain()[0].getTime()) / (24 * 3600 * 1000))), 1));
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
                // const x = d3
                //     .scaleTime()
                //     .domain([new Date(data[i][0][0]), d3.timeDay.offset(new Date(data[i][data[i].length - 1][0]), 8)])
                //     .rangeRound([0, contentWidth]);
                g.selectAll('.bar' + data[i].name)
                    .data(data[i].data)
                    .enter().append('rect')
                    .attr('class', 'bar bar' + data[i].name)
                    // .attr('class', 'bar' + data[i].name)
                    .attr('x', d => actualX(new Date(d[0])))
                    // .attr('y', d => actualY(d[1]))
                    .attr('y', function(d) {
                        if (d[1] < 1) {
                            return 0;
                        } else if (d[1] < 2) {
                            return actualY(2) + ((actualY(1) - actualY(2))/2);
                        } else {
                            return actualY(d[1]);
                        }
                    })
                    // .attr('width', contentWidth / data[i].data.length)
                    .attr('width', Math.max(0.9 * (contentWidth / ((actualX.domain()[1].getTime() - actualX.domain()[0].getTime()) / (24 * 3600 * 1000))), 1))
                    .attr('height', function(d) {
                        if (d[1] < 1) {
                            return 0;
                        } else if (d[1] < 2) {
                            return actualY(1) - actualY(2) - ((actualY(1) - actualY(2))/2);
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
                                new Date(d[0]).toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                                + '</p>' +
                                '<p style="display: block; margin: 0; font-size: small; font-weight: bold">' + data[i].name + ': ' + d[1] + '</p>')
                            .style('left', actualX(d[0]) + 5 + 'px')
                            .style('border-color', data[i].color)
                            .style('margin-top', -25 + 'px');
                            // .style('top', 0 + 'px');
                    });
                    // .append('title').text(d => '' + data[i].name + ' - ' + new Date(d[0]).toISOString() + ' - ' + d[1]);
            }
        }


        function drawSelections() {
            // shadow over whole chart
            g.selectAll('.shadowBar').remove();
            if (selections.length > 0) {
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
                    .data(selections)
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
                .data(selections)
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
                            d[0] = actualX.invert(dragX);
                            drawSelections();
                        } else {
                            d[1] = actualX.invert(dragX);
                            drawSelections();
                        }
                        thisClass.selectionsDebouncer.next(selections);
                    })
                );
            svgSel.selectAll('.selectionLineRight').remove();
            svgSel.selectAll('.selectionLineRight')
                .data(selections)
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
                            d[1] = actualX.invert(dragX);
                            drawSelections();
                        } else {
                            d[0] = actualX.invert(dragX);
                            drawSelections();
                        }
                        thisClass.selectionsDebouncer.next(selections);
                    })
                );
            // selection buttons

            svg.selectAll('.selectionRemoveButtonIcon').remove();
            svg.selectAll('.selectionRemoveButtonIcon')
                .data(selections)
                .enter()
                .append('svg:foreignObject')
                .attr('class', 'selectionRemoveButtonIcon')
                // .attr('x', 10)
                .attr('x', d => actualX(d[1]) + 8 + margin.left)
                .attr('y', 3 + margin.top)
                .attr('width', 20)
                .attr('height', 20)
                // .style('visibility', 'hidden')
                .append('xhtml:span')
                .attr('class', 'glyphicon glyphicon-remove');

            svg.selectAll('.selectionRemoveButton').remove();
            svg.selectAll('.selectionRemoveButton')
                .data(selections)
                .enter()
                .append('circle')
                .attr('class', 'selectionRemoveButton')
                // .classed('selectionRemoveButton', true)
                .attr('cx', d => actualX(d[1]) + 15 + margin.left)
                .attr('r', 10)
                .attr('cy', 12 + margin.top)
                // .attr('fill', 'rgba(220, 220, 220, 0.8)')
                .style('fill-opacity', 0)
                .style('stroke', '#333333')
                .style('stroke-width', 2)
                .style('cursor', 'pointer')
                // .style('visibility', 'hidden')
                .on('click', function(d, i) {
                    selections.splice(i, 1);
                    drawSelections();
                    thisClass.selectionsDebouncer.next(selections);
                })
                .append('title').text('Remove this selection');

            svg.selectAll('.selectionZoomInButtonIcon').remove();
            svg.selectAll('.selectionZoomInButtonIcon')
                .data(selections)
                .enter()
                .append('svg:foreignObject')
                .attr('class', 'selectionZoomInButtonIcon')
                // .attr('x', 10)
                .attr('x', d => actualX(d[1]) + 33 + margin.left)
                .attr('y', 3 + margin.top)
                .attr('width', 20)
                .attr('height', 20)
                // .style('visibility', 'hidden')
                .append('xhtml:span')
                .attr('class', 'glyphicon glyphicon-resize-small');

            svg.selectAll('.selectionZoomInButton').remove();
            svg.selectAll('.selectionZoomInButton')
                .data(selections)
                .enter()
                .append('circle')
                .attr('class', 'selectionZoomInButton')
                // .classed('selectionRemoveButton', true)
                .attr('cx', d => actualX(d[1]) + 40 + margin.left)
                .attr('r', 10)
                .attr('cy', 12 + margin.top)
                // .attr('fill', 'rgba(220, 220, 220, 0.8)')
                .style('fill-opacity', 0)
                .style('stroke', '#333333')
                .style('stroke-width', 2)
                .style('cursor', 'pointer')
                // .style('visibility', 'hidden')
                .on('click', function(d, i) {
                    zoomIn(d);
                })
                .append('title').text('Zoom into selection');



            // g.selectAll('.selectionRemoveButtonIcon').remove();
            // g.selectAll('.selectionRemoveButtonIcon')
            //     .data(selections)
            //     .enter()
            //     .append('text')
            //     .attr('class', 'selectionRemoveButtonIcon glyphicon glyphicon-remove')
            //     .attr('x', d => actualX(d[1]) + 10)
            //     .attr('y', 7)
            //     // .attr('width', 10)
            //     // .attr('height', 10)
            //     // .html('<span class="glyphicon glyphicon-remove"></span>')
            //     .text('&#xe014;')
            //     .attr('fill', '#333333');
                // .attr('x', d => actualX(d[1]) + 10)
                // .attr('y', 7)
                // .attr('width', 10)
                // .attr('height', 10);
            // g.selectAll('.selectionRemoveButtonIcon').remove();
            // g.selectAll('.selectionRemoveButtonIcon')
            //     .data(selections)
            //     .enter()
            //     .append('text')
            //     .attr('class', 'selectionRemoveButtonIcon glyphicon glyphicon-remove')
            //     // .classed('selectionRemoveButton', true)
            //     .attr('x', d => actualX(d[1]) + 10)
            //     .attr('y', 7)
            //     .attr('width', 10)
            //     .attr('height', 10)
            //     .text('\\&#xe014;')
            //     .attr('fill', 'rgba(220, 220, 220, 0.8)')
            //     // .style('fill-opacity', 0.8)
            //     .style('stroke', '#333333')
            //     .style('cursor', 'pointer');

            // selection border text
            svg.selectAll('.selectionTextL').remove();
            svg.selectAll('.selectionTextL')
                .data(selections)
                .enter()
                .append('svg:foreignObject')
                .attr('class', 'selectionTextL')
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
                .append('xhtml:span')
                // .style('position', 'relative')
                // .style('border', '2px solid blue')
                .html(function(d) {
                    const date = new Date(d[0]);
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
                .data(selections)
                .enter()
                .append('svg:foreignObject')
                .attr('class', 'selectionTextR')
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
                    d[1] = new Date(thisElement.value);
                    drawSelections();
                    thisClass.selectionsDebouncer.next(selections);
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
                //     // return '<input type="datetime-local" style="display: block" value="' + date.toISOString().split('.')[0] + '" (change)="console.log(' + date + ')">';
                //     // return '<p style="display: block; margin: 0; font-size: small">' +
                //     //     date.getUTCFullYear() + '-' +
                //     //     (date.getUTCMonth() + 1).toLocaleString('en-US', {minimumIntegerDigits: 2}) +
                //     //     '-' + date.getUTCDate().toLocaleString('en-US', {minimumIntegerDigits: 2}) +
                //     //     '</p><p style="display: block; margin: 0; font-size: x-small;">' +
                //     //     date.getUTCHours().toLocaleString('en-US', {minimumIntegerDigits: 2}) +
                //     //     ':' + date.getUTCMinutes().toLocaleString('en-US', {minimumIntegerDigits: 2}) +
                //     //     ':' + date.getUTCSeconds().toLocaleString('en-US', {minimumIntegerDigits: 2});
                // });
        }

        let dragStartX;
        function dragStart() {
            dragStartX = d3.event.x - margin.left;
            console.log('drag start', actualX.invert(dragStartX));
            g.selectAll('.dragRect').remove();
            g.append('rect')
                .attr('class', 'dragRect')
                .attr('x', actualX(actualX.invert(dragStartX)))
                .attr('y', 0)
                .attr('width', 0)
                .attr('height', contentHeight)
                .attr('fill', 'rgba(66, 135, 245, 0.4)');
        }

        function dragEnd() {
            const draggedX = d3.event.x - margin.left;
            if (draggedX - dragStartX !== 0) {
                if (draggedX < dragStartX) {
                    selections.push([actualX.invert(draggedX), actualX.invert(dragStartX)]);
                } else {
                    selections.push([actualX.invert(dragStartX), actualX.invert(draggedX)]);
                }
                thisClass.selectionsDebouncer.next(selections);
                console.log('drag end', draggedX, x(draggedX), d3.mouse(this), selections);
                g.selectAll('.dragRect').remove();
                drawSelections();
            }

        }

        function dragging() {
            const dragSelectionX = d3.event.x - margin.left;
            // console.log('drag', dragSelectionX);
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
    }

    onResize() {
        this.createChart();
    }

    showAndHideTraces(types: string[]) {
        d3.selectAll('.bar').style('visibility', 'hidden');
        for (const typeName of types) {
            d3.selectAll('.bar' + typeName).style('visibility', 'visible');
        }
    }
}
