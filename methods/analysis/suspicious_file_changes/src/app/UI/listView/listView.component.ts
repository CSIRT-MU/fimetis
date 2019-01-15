import {Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild, AfterViewInit, ElementRef} from '@angular/core';
import {MatDatepickerInputEvent, MatDialog, MatPaginator, MatSort, MatTable, MatTableDataSource, PageEvent} from '@angular/material';
import {ActivatedRoute} from '@angular/router';

import {ElasticsearchService} from '../../elasticsearch.service';
import {FormControl} from '@angular/forms';
import {GraphComponent} from '../graph/graph.component';
import {SelectionModel} from '@angular/cdk/collections';
import {SelectDialogComponent} from '../dialog/select-dialog/select-dialog.component';
import {Observable} from 'rxjs';
import 'rxjs/add/observable/of';
import {fromArray} from 'rxjs/internal/observable/fromArray';
import PerfectScrollbar from 'perfect-scrollbar';
import {VirtualArrayModel} from '../../models/virtualArray.model';
import 'hyperlist/dist/hyperlist.js';
import * as HyperList from 'hyperlist';
import {ComputationModel} from '../../models/computation.model';
import {ClusterManager} from '../../businessLayer/clusterManager';
import {ClusterModel, ClusterSelectMode} from '../../models/cluster.model';
import {TextSelectEvent, SelectionRectangle} from '../text-select.directive';
import {FilterModel} from '../../models/filter.model';
import * as lodash from 'lodash';
import {VirtualScrollerComponent} from 'ngx-virtual-scroller';
import {ElasticsearchBaseQueryManager} from '../../businessLayer/elasticsearchBaseQueryManager';

@Component({
    selector: 'app-list-view',
    templateUrl: './listView.component.html',
    styleUrls: ['./listView.component.css']
})
export class ListViewComponent implements OnInit, OnDestroy {

    @Input('case')
    case: string;
    @Input('filter')
    filter: string;
    @Input('computations')
    computations: ComputationModel[];
    @Input('displayedClusters')
    displayedClusters: string[];
    @Input('clusters')
    clusters: ClusterModel[] = [];
    oldClusters: ClusterModel[] = [];
    private SIZE = 25;
    private sub: any;

    @Output('graphChangedBoundary') graphChangedBoundary: EventEmitter<any> = new EventEmitter<any>();
    @Output('makeManualCluster') makeManualCluster: EventEmitter<ComputationModel> = new EventEmitter<ComputationModel>();
    @Output('additionalFiltersChanged') additionalFiltersChanged: EventEmitter<Map<string, string>> = new EventEmitter<Map<string, string>>();

    tablePanelOpenState = true;

    searchString = '';
    additionalFilters: Map<string, string> = new Map<string, string>();

    tableSelection = new SelectionModel<any>(true, []);
    availableTableColumns = ['select', 'doctype', 'timestamp', 'size', 'type', 'mode', 'uid', 'gid', 'inode', 'name', 'M-Time', 'A-Time', 'C-Time', 'B-Time', 'id'];
    displayedTableColumns = ['select', 'timestamp', 'size', 'type', 'mode', 'uid', 'gid', 'name'];
    data: any[];
    public highlightedTextBox: SelectionRectangle | null;
    highlightedText: string;
    highlightedTextId: number;

    public highlightedTextDateBox: SelectionRectangle | null;
    highlightedTextDate: string;
    highlightedTextDateId: number;

    selected_rows_id: Set<string> = new Set<string>();

    haveNextPage = false;
    scrollID = '';
    notice = '';
    total = 0;

    // pagination
    page_number = 1;
    page_size = 1500000;
    // Virtual scroll
    listViewScrollHeight = 10;
    virtualArray: VirtualArrayModel = new VirtualArrayModel();
    visibleData: any[] = [];
    preloadedData: any[] = [];
    preloadedBegin = 0;
    preloadedRequestedBegin: number;
    preloadedEnd;
    // preloadVisibleStart = 0;
    preloadedBufferSize = 4000; // buffer window size - minimum = (2*preloadBufferBorder) + preloadBufferOffset
    preloadBufferOffset = 1200; // shift of buffer window - should be bigger than preloadBufferBorder
    preloadBufferBorder = 1000; // when to trigger buffer shift (to the end of buffer window)
    preloadBufferState = false;
    visibleDataFirstIndex = 0;
    visibleDataLastIndex = 0;


    loadingData = false;

    tableDisplayType = 'timestamps';
    pageSortString = 'timestamp';
    pageSortOrder = 'asc';
    pageSizeOptions: number[] = [5, 10, 25, 100, 500, 1000];
    pageEvent: PageEvent;

    private clusterManager: ClusterManager;
    private elasticsearchBaseQueryManager: ElasticsearchBaseQueryManager;

    @ViewChild(MatPaginator) topPaginator: MatPaginator;
    @ViewChild(MatPaginator) bottomPaginator: MatPaginator;

    @ViewChild(GraphComponent) showGraph: GraphComponent;

    @ViewChild(MatTable) interactiveTable: MatTable<any>;
    @ViewChild('highlightedBox') highlightedBox: ElementRef;
    @ViewChild('highlightedDateBox') highlightedDateBox: ElementRef;
    @ViewChild(VirtualScrollerComponent) virtualScroller: VirtualScrollerComponent;

    constructor(private es: ElasticsearchService, private route: ActivatedRoute, public dialog: MatDialog) {
        this.scrollID = '';
        this.notice = '';
        this.haveNextPage = true;
        this.total = 0;
        this.pageEvent = new PageEvent();
        this.pageEvent.pageIndex = 0;
        this.pageEvent.pageSize = this.SIZE;
        this.elasticsearchBaseQueryManager = new ElasticsearchBaseQueryManager();
        this.clusterManager = new ClusterManager(this.es);
        this.highlightedTextBox = null;
        this.highlightedText = '';

        this.highlightedTextDateBox = null;
        this.highlightedTextDate = '';
    }

    ngOnInit() {
        this.sub = this.route.params.subscribe(params => {
            this.case = params['case'];
        });
    }

    ngOnDestroy() {
        this.sub.unsubscribe();
    }

    /**
     * Initializes list asynchronously
     * @returns {Promise<void>}
     */
    async init() {
        this.loadingData = true;
        this.clusterManager.additional_filters = Array.from(this.additionalFilters.values());
        this.clusterManager.case = this.case;
        this.clusterManager.clusters = this.clusters;
        const shift = await this.clusterManager.getDifferenceShift(this.oldClusters, this.visibleDataFirstIndex, this.visibleData[0]);
        // const loadEvent = {};
        // loadEvent['start'] = this.visibleDataFirstIndex;
        // loadEvent['end'] = this.visibleDataLastIndex === 0 ? (this.visibleDataFirstIndex + 20) : this.visibleDataLastIndex;
        // this.loadVisibleData(loadEvent);
        // let size = this.visibleDataLastIndex - this.visibleDataFirstIndex + 1;
        // if (size === 0) {
        //     size = 20;
        // }
        const initSize = 200;
        this.clusterManager.getData(this.visibleDataFirstIndex, initSize, this.pageSortString, this.pageSortOrder)
            .then(resp => {
                console.log('list data loaded async', resp, resp.data, resp.total);
                this.data = resp.data;
                this.total = resp.total;
                this.preloadedData = resp.data;
                this.preloadedBegin = this.visibleDataFirstIndex;
                this.preloadedEnd = this.visibleDataFirstIndex + initSize;
                this.virtualArray.length = this.total;
                this.loadingData = false;
                this.visibleData = this.data;
            });
        this.virtualScroller.scrollToIndex(this.visibleDataFirstIndex + shift);
        this.oldClusters = lodash.cloneDeep(this.clusters);
        this.virtualScroller.refresh();
    }

    setPageSizeOptions(setPageSizeOptionsInput: string) {
        this.pageSizeOptions = setPageSizeOptionsInput.split(',').map(str => +str);
    }

    changeDatePickers($event) {
        this.graphChangedBoundary.emit($event);
    }

    isAllSelected() {
        const numSelected = this.tableSelection.selected.length;
        const numRows = this.data.length;
        return numSelected >= numRows;
    }

    /** Selects all rows if they are not all selected; otherwise clear selection. */
    masterToggle() {
        this.isAllSelected() ?
            this.tableSelection.clear() :
            this.data.forEach(row => this.tableSelection.select(row));
    }

    tableSort($event) {
        console.log($event);
        let pageSort = $event['active'];
        if (pageSort === 'M Time' || pageSort === 'A Time' || pageSort === 'C Time' || pageSort === 'B Time') {
            pageSort = 'timestamp';
        }
        this.pageSortString = pageSort;
        this.pageSortOrder = $event['direction'];
        this.init();
    }

    /**
     * Filters data by search string
     */
    searchByString() {
        console.log('search', this.searchString);
        if (this.searchString !== '') {
            this.additionalFilters.set('searchString', this.elasticsearchBaseQueryManager.buildAdditionSearchFilter(this.searchString));
            this.init();
        } else if (this.additionalFilters.has('searchString')) {
            this.additionalFilters.delete('searchString');
            this.init();
        }
        this.additionalFiltersChanged.emit(this.additionalFilters);
    }

    /**
     * Filters data by Date
     * @param {string} from Date
     * @param {string} to Date
     */
    timeRangeFilter(from: string, to: string) {
        console.log('time range filter: from:', from, 'to:', to);
        if (from != null || to != null) {
            if (from !== undefined || to !== undefined) {
                this.additionalFilters.set('timeRange', this.elasticsearchBaseQueryManager.buildAdditionRangeFilter(from, to));
                this.init();
            }
        }
        this.additionalFiltersChanged.emit(this.additionalFilters);
    }

    /**
     * Filters data in view by metadata types
     * @param types
     */
    typeFilter(types) {
        console.log('type filter:', types);
        if (types != null) {
            if (types !== undefined) {
                this.additionalFilters.set('typeFilter', this.elasticsearchBaseQueryManager.buildAdditionMactimeTypeFilter(Array.from(types)));
                this.init();
            }
        }
        this.additionalFiltersChanged.emit(this.additionalFilters);
    }

    /**
     * Opens dialog to edit visible table columns
     */
    editTableColumns() {
        const dialogRef = this.dialog.open(SelectDialogComponent, {
            width: '350px',
            data: {
                title: 'Select table columns',
                available: this.availableTableColumns,
                selected: this.displayedTableColumns
            }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result != null) {
                console.log(result);
                this.displayedTableColumns = result;
                // this.displayedTableColumns = ['name'];
            }
        });
    }

    showScroll($event) {
        // console.log($event);
        // console.log(this.scrollbar.autoPropagation);
        // console.log(this.scrollbar.states);
        // console.log($event.target.offsetHeight);
        // console.log($event.target.scrollTop);
        // const thumb = document.getElementById('interactive-table-scroll').getElementsByClassName('ps__thumb-y')[0] as HTMLElement;
        // thumb.style.height = '10px';
        // console.log(thumb.clientHeight);
    }

    /**
     * Method called by virtual scroll to get visible data from database or preloaded buffer.
     * @param $event Virtual scroll event
     */
    loadVisibleData($event) {
        console.log($event);
        const start = $event['start'];
        const end = $event['end'];
        // console.log('visible start index:', this.visibleDataFirstIndex);
        this.visibleDataFirstIndex = start < 0 ? 0 : start;
        this.visibleDataLastIndex = end < 0 ? 0 : end;
        if (this.virtualArray.length > 0) { // get rid of fake loading state if empty
            if (end <= this.preloadedEnd && start >= this.preloadedBegin) {
                this.visibleData = this.preloadedData.slice(
                    (start - this.preloadedBegin),
                    (end - (this.preloadedBegin) + 1)
                );
                console.log((start - this.preloadedBegin),
                    (end - (this.preloadedBegin) + 1));
                console.log('arr', this.preloadedData[(start - this.preloadedBegin)]);
                if ((start - this.preloadedBegin < this.preloadBufferBorder) && (start > this.preloadBufferBorder)) {
                    // console.log('start border triggered', 'start:', start, 'preload begin:', this.preloadedBegin, 'buffer border:', this.preloadBufferBorder);
                    const begVal = start - this.preloadBufferOffset < 0 ? 0 : start - this.preloadBufferOffset;
                    this.preloadData(begVal, this.preloadedBufferSize, null, null, false, true);
                }
                if (this.preloadedEnd - end < this.preloadBufferBorder && this.preloadedEnd < this.total) {
                    // console.log('end border triggered', 'end:', end, 'preload end:', this.preloadedEnd, 'buffer border:', this.preloadBufferBorder);
                    const begVal = start - this.preloadBufferOffset < 0 ? 0 : start - this.preloadBufferOffset;
                    this.preloadData(begVal, this.preloadedBufferSize, null, null, false, true);
                }
            } else {
                if (end > this.preloadedEnd) {
                    const begVal = end - (this.preloadedBufferSize - this.preloadBufferOffset) < 0 ? 0 : end - (this.preloadedBufferSize - this.preloadBufferOffset);
                    this.preloadData(begVal, this.preloadedBufferSize, start, end, true, false);
                } else {
                    const begVal = start - this.preloadBufferOffset < 0 ? 0 : start - this.preloadBufferOffset;
                    this.preloadData(begVal, this.preloadedBufferSize, start, end, true, false);
                }
            }
        }
    }

    /**
     * Method called to preload data to buffer for virtual scroll.
     * @param begin Offset of loading data
     * @param size Size of loading data
     * @param visibleDataStart Start index of displayed data
     * @param visibleDataEnd end index of displayed data
     * @param {boolean} loadingState If true then loading bar is visible
     * @param {boolean} preloadBuffer If true then preloading is triggered
     */
    preloadData(begin, size, visibleDataStart, visibleDataEnd, loadingState: boolean, preloadBuffer: boolean) {
        this.preloadedRequestedBegin = begin;
        console.log('preload data: ', begin, size, loadingState, preloadBuffer);
        if (!this.preloadBufferState && preloadBuffer) {
            console.log('calling preload');
            this.preloadBufferState = true;
            this.dataLoader(begin, size, visibleDataStart, visibleDataEnd, loadingState, preloadBuffer);
        } else if (!preloadBuffer) {
            setTimeout(() => {
                if (this.preloadedRequestedBegin === begin) {
                    this.dataLoader(begin, size, visibleDataStart, visibleDataEnd, loadingState, preloadBuffer);
                }
            }, 300);
        }

    }

    /**
     * Method called to load data from database into buffer.
     * @param begin Offset of loading data
     * @param size Size of loading data
     * @param visibleDataStart Start index of displayed data
     * @param visibleDataEnd end index of displayed data
     * @param {boolean} loadingState If true then loading bar is visible
     * @param {boolean} preloadBuffer If true then preloading is triggered
     */
    dataLoader(begin, size, visibleDataStart, visibleDataEnd, loadingState: boolean, preloadBuffer: boolean) {
        if (loadingState) {
            this.loadingData = true;
        }
        const begin_with_page = begin + ((this.page_number - 1) * this.page_size);
        this.clusterManager.getData(begin_with_page, size, this.pageSortString, this.pageSortOrder)
            .then(resp => {
                console.log('??? async called virtual scroll', resp, resp.data, resp.total, 'from: ', begin, 'size: ', size);
                this.preloadedData = resp.data;
                this.preloadedBegin = begin;
                this.preloadedEnd = this.preloadedBegin + size;
                if (visibleDataStart != null && visibleDataEnd != null) {
                    this.visibleData = this.preloadedData.slice(
                        (visibleDataStart - this.preloadedBegin),
                        (visibleDataEnd - (this.preloadedBegin) + 1)
                    );
                }
            }).then(() => {
            console.log('Preload data - done!');
            if (loadingState) {
                this.loadingData = false;
            }
            if (preloadBuffer) {
                this.preloadBufferState = false;
            }
        });
    }

    /**
     * Add item with given id to selection
     * @param id Id of item in database
     */
    tableSelect(id) {
        if (this.selected_rows_id.has(id)) {
            this.selected_rows_id.delete(id);
        } else {
            this.selected_rows_id.add(id);
        }
    }

    resizeList(height) {
        this.listViewScrollHeight = height;
    }

    /**
     * Opens context menu after highlighting some text (mouse selection)
     * @param {TextSelectEvent} event
     * @param index Index of item in list
     */
    openHighlightedTextMenu(event: TextSelectEvent, index) {
        console.group('Text Select Event');
        console.log('Text:', event.text);
        console.log('Viewport Rectangle:', event.viewportRectangle);
        console.log('Host Rectangle:', event.hostRectangle);
        console.groupEnd();
        this.highlightedTextId = index + this.visibleDataFirstIndex;
        if (event.hostRectangle) {

            this.highlightedTextBox = event.hostRectangle;
            this.highlightedText = event.text;
            this.highlightedBox.nativeElement.style.display = 'block';
            this.highlightedBox.nativeElement.style.top = (event.viewportRectangle.top - 35) + 'px';
            this.highlightedBox.nativeElement.style.left = event.viewportRectangle.left + 'px';

        } else {
            this.highlightedBox.nativeElement.style.display = 'none';
            this.highlightedTextBox = null;
            this.highlightedText = '';

        }
    }

    /**
     * Opens context menu after highlighting timestamp (mouse selection)
     * @param {TextSelectEvent} event
     * @param index Index of item in list
     */
    openHighlightedTextDateMenu(event: TextSelectEvent, index) {
        console.group('Text Select Date Event');
        console.log('Text:', event.text);
        console.log('Viewport Rectangle:', event.viewportRectangle);
        console.log('Host Rectangle:', event.hostRectangle);
        console.groupEnd();
        this.highlightedTextDateId = index + this.visibleDataFirstIndex;
        if (event.hostRectangle) {

            this.highlightedTextDateBox = event.hostRectangle;
            this.highlightedTextDate = event.text;
            this.highlightedDateBox.nativeElement.style.display = 'block';
            this.highlightedDateBox.nativeElement.style.top = (event.viewportRectangle.top - 35) + 'px';
            this.highlightedDateBox.nativeElement.style.left = event.viewportRectangle.left + 'px';

        } else {
            this.highlightedDateBox.nativeElement.style.display = 'none';
            this.highlightedTextDateBox = null;
            this.highlightedTextDate = '';

        }
    }

    /**
     * Creates filter by highlighted prefix (mouse selection)
     */
    makeClusterByHighlight(): void {
        console.log('text', this.highlightedText);
        const computation = new ComputationModel();
        computation.name = this.highlightedText;
        computation.color = '#3d9fea';
        computation.isSelected = true;
        const filter = new FilterModel();
        filter.json = this.elasticsearchBaseQueryManager.buildAdditionSearchFilter(this.highlightedText);
        filter.isSelected = true;
        filter.name = 'highlighted_text';
        filter.type = 'REGEX';
        computation.filters.add(filter);
        this.makeManualCluster.emit(computation);
    }

    /**
     * Skips (scrolls) the block by highlighted prefix (mouse selection)
     * @param {boolean} toTheEnd If true then skip to the end of the block else skip to the start
     */
    skipTheBlockByHighlight(toTheEnd: boolean): void {
        console.log('skip from', this.highlightedTextId, this.visibleDataFirstIndex, this.preloadedBegin);
        let skipIndex = this.highlightedTextId;
        let test = this.highlightedText;
        const index_start = (this.highlightedTextId - this.preloadedBegin);
        const bufferOffset = this.preloadedBegin;
        test = test.replace('/', '\\/')
            .replace('.', '\\.')
            .replace('-', '\\-')
            .replace('(', '\\(')
            .replace(')', '\\)')
            .replace('[', '\\[')
            .replace(']', '\\]')
            .replace('*', '\\*')
            .replace('+', '\\+')
            .replace('{', '\\{')
            .replace('}', '\\}')
            .replace('^', '\\^')
            .replace('?', '\\?')
            .replace('<', '\\<')
            .replace('>', '\\>')
            .replace('&', '\\&')
            .replace('$', '\\$')
            .replace('|', '\\|');
        test += '.*';
        const regex = new RegExp(test);
        console.log(test);
        console.log(regex);
        if (toTheEnd) {
            for (let index = (index_start + 1); index < this.preloadedBufferSize; index++) {
                if (regex.test(this.preloadedData[index]._source['File Name']) === false) {
                    skipIndex = index;
                    break;
                }
            }
        } else {
            for (let index = (index_start - 1); index >= 0; index--) {
                if (regex.test(this.preloadedData[index]._source['File Name']) === false) {
                    skipIndex = index;
                    break;
                }
            }
        }
        console.log('skip to:', skipIndex + bufferOffset);
        this.virtualScroller.scrollToIndex(skipIndex + bufferOffset);
        const hideEvent: TextSelectEvent = {text: ' ', viewportRectangle: null, hostRectangle: null};
        this.openHighlightedTextMenu(hideEvent, 0);
    }

    /**
     * Skips (scrolls) the block by highlighted timestamp (mouse selection)
     * @param {boolean} toTheEnd If true then skip to the end of the block else skip to the start
     */
    skipTheBlockByDate(toTheEnd: boolean): void {
        console.log('skip from', this.highlightedTextDateId, this.visibleDataFirstIndex, this.preloadedBegin);
        let skipIndex = this.highlightedTextDateId;

        const datetimeRegex = new RegExp(/(\d{2}).(\d{2}).(\d{4}) (\d{2}):(\d{2}):(\d{2})/g);
        const result = datetimeRegex.exec(this.highlightedTextDate);
        const selectedDate =
            new Date(result[2] + '.' + result[1] + '.' + result[3] + ' ' + result[4] + ':' + result[5] + ':' + result[6]);

        const index_start = (this.highlightedTextDateId - this.preloadedBegin);
        const bufferOffset = this.preloadedBegin;

        if (toTheEnd) {
            for (let index = (index_start + 1); index < this.preloadedBufferSize; index++) {
                const next_date = new Date(this.preloadedData[index]._source['@timestamp']);
                if (selectedDate.getTime() < next_date.getTime()) {
                    skipIndex = index;
                    break;
                }
            }
        } else {
            for (let index = (index_start - 1); index >= 0; index--) {
                const next_date = new Date(this.preloadedData[index]._source['@timestamp']);
                if (selectedDate.getTime() > next_date.getTime()) {
                    skipIndex = index;
                    break;
                }
            }
        }
        console.log('skip to:', skipIndex + bufferOffset);
        this.virtualScroller.scrollToIndex(skipIndex + bufferOffset);
        const hideEvent: TextSelectEvent = {text: ' ', viewportRectangle: null, hostRectangle: null};
        this.openHighlightedTextDateMenu(hideEvent, 0);
    }

    testClick($event, index) {
        console.log($event);
        console.log($event.target.textContent);
        const elemRef = document.getElementById('file_' + index);


    }

    testClickDate($event, index) {
        console.log($event);
        console.log($event.target.textContent);
        const elemRef = document.getElementById('date_' + index);


    }
}
