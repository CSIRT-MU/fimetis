import {Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild, AfterViewInit, ElementRef} from '@angular/core';
import {MatDatepickerInputEvent, MatDialog, MatPaginator, MatSort, MatTable, MatTableDataSource, PageEvent} from '@angular/material';
import { ActivatedRoute } from '@angular/router';

import { ElasticsearchService } from '../../elasticsearch.service';
import {FormControl} from '@angular/forms';
import {GraphComponent} from '../graph/graph.component';
import {SelectionModel} from '@angular/cdk/collections';
import {FilterService} from '../../filter.service';
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
import { TextSelectEvent, SelectionRectangle } from '../text-select.directive';
import {FilterModel} from '../../models/filter.model';
import * as lodash from 'lodash';
import {VirtualScrollerComponent} from 'ngx-virtual-scroller';

@Component({
  selector: 'app-list-view',
  templateUrl: './listView.component.html',
  styleUrls: ['./listView.component.css']
})
export class ListViewComponent implements OnInit, OnDestroy {

  @Input('index')
  index = 'metadata';
  @Input('type')
  type: string;
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

  tablePanelOpenState = true;

  searchString = '';
  additionalFilters: Map<string, string> = new Map<string, string>();

  tableSelection = new SelectionModel<any>(true, []);
  availableTableColumns = ['select', 'doctype', 'timestamp', 'size', 'type', 'mode', 'uid', 'gid', 'inode', 'name', 'M-Time', 'A-Time', 'C-Time', 'B-Time', 'id'];
  displayedTableColumns = ['select', 'timestamp', 'size', 'type', 'mode', 'uid', 'gid', 'inode', 'name'];
  data: any[];
  public highlightedTextBox: SelectionRectangle | null;
  highlightedText: string;
  highlightedTextId: number;

  selected_rows_id: Set<string> = new Set<string>();

  haveNextPage = false;
  scrollID = '';
  notice = '';
  total = 0;


  // Virtual scroll
  listViewScrollHeight = 10;
  virtualArray: VirtualArrayModel = new VirtualArrayModel();
  visibleData: any[] = [];
  preloadedData: any[] = [];
  preloadedBegin = 0;
  preloadedRequestedBegin: number;
  preloadedEnd;
  preloadVisibleStart = 0;
  preloadedBufferSize = 4000; // buffer window size minimum = (2*preloadBufferBorder) + preloadBufferOffset
  preloadBufferOffset = 1000; // shift of buffer window
  preloadBufferBorder = 1200; // when to trigger buffer shift (to the end of buffer window)
  preloadBufferState = false;
  visibleDataFirstIndex = 0;


  loadingData = false;

  tableDisplayType = 'timestamps';
  pageSortString = 'timestamp';
  pageSortOrder = 'asc';
  pageSizeOptions: number[] = [5, 10, 25, 100, 500, 1000];
  pageEvent: PageEvent;

  private clusterManager: ClusterManager;

  @ViewChild(MatPaginator) topPaginator: MatPaginator;
  @ViewChild(MatPaginator) bottomPaginator: MatPaginator;

  @ViewChild(GraphComponent) showGraph: GraphComponent;

  @ViewChild(MatTable) interactiveTable: MatTable<any>;
  @ViewChild('highlightedBox') highlightedBox: ElementRef;
  @ViewChild(VirtualScrollerComponent) virtualScroller: VirtualScrollerComponent;

  constructor(private es: ElasticsearchService, private fs: FilterService, private route: ActivatedRoute, public dialog: MatDialog) {
    this.scrollID = '';
    this.notice = '';
    this.haveNextPage = true;
    this.total = 0;
    this.pageEvent = new PageEvent();
    this.pageEvent.pageIndex = 0;
    this.pageEvent.pageSize = this.SIZE;
    this.clusterManager = new ClusterManager(this.es);
      this.highlightedTextBox = null;
      this.highlightedText = '';
  }

  // ngOnInit() {
  //   this.es.getAllDocuments(ListViewComponent.INDEX, ListViewComponent.TYPE)
  //     .then(response => {
  //       this.data = response.hits.hits;
  //       this.metadataSources = response.hits.hits;
  //       console.log(response);
  //     }, error => {
  //       console.error(error);
  //     }).then(() => {
  //       console.log('Show Metadata Completed!');
  //     });
  // }

  // ngOnInit() {
  //   this.es.getAllDocumentsWithScroll(
  //     ListViewComponent.INDEX,
  //     ListViewComponent.TYPE,
  //     ListViewComponent.SIZE).then(
  //     response => {
  //       this.data = response.hits.hits;
  //
  //       if (response.hits.hits.length < response.hits.total) {
  //         this.haveNextPage = true;
  //         this.scrollID = response._scroll_id;
  //       }
  //       console.log(response);
  //     }, error => {
  //       console.error(error);
  //     }).then(() => {
  //     console.log('Show Metadata Completed!');
  //   });
  // }

  ngOnInit() {
    this.sub = this.route.params.subscribe(params => {
      this.case = params['case'];
      this.type = params['type'];
      // if (this.type === 'aggregated-mactimes') {
      //   this.es.getAggregatedPage(
      //     this.index,
      //     this.type,
      //     this.case,
      //     this.pageEvent.pageSize,
      //     this.pageEvent.pageIndex
      //   ).then(
      //     response => {
      //       this.data = response.hits.hits;
      //       this.total = response.hits.total;
      //       this.scrollID = response._scroll_id;
      //       console.log(response);
      //     }, error => {
      //       console.error(error);
      //     }).then(() => {
      //     console.log('Show Metadata Completed!');
      //   });
      // } else {
      //   this.es.getPage(
      //     this.index,
      //     this.type,
      //     this.case,
      //     this.pageEvent.pageSize,
      //     this.pageEvent.pageIndex
      //   ).then(
      //     response => {
      //       this.data = response.hits.hits;
      //       this.total = response.hits.total;
      //       this.scrollID = response._scroll_id;
      //       console.log(response);
      //     }, error => {
      //       console.error(error);
      //     }).then(() => {
      //     console.log('Show Metadata Completed!');
      //   });
      // }
    });
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  init() {
    this.loadingData = true;
    console.log('CLUSTERS DIFF', this.clusters, this.oldClusters, this.preloadVisibleStart, this.visibleData[0]);
    this.clusterManager.additional_filters = Array.from(this.additionalFilters.values());
    this.clusterManager.case = this.case;
    this.clusterManager.clusters = this.clusters;
    // this.clusterManager.getDifferenceShift(this.oldClusters, this.visibleDataFirstIndex, this.visibleData[0]);
    this.clusterManager.getData(this.index, this.type, 0, this.pageEvent.pageSize, this.pageSortString, this.pageSortOrder)
        .then(resp => {
          console.log('list data loaded async', resp, resp.data, resp.total);
          this.data = resp.data;
          this.total = resp.total;
          this.preloadedData = resp.data;
          this.preloadedBegin = 0;
          this.preloadedEnd = this.pageEvent.pageSize;
          this.virtualArray.length = this.total;
          this.loadingData = false;
          this.visibleData = this.data;
        });
    this.oldClusters = lodash.cloneDeep(this.clusters);
  }

  showNextPage() {
    if (this.scrollID == null) {
      this.pageEvent.pageIndex --;
      if (this.type === 'aggregated-mactimes') {
        this.es.getAggregatedPageWithScroll(
          this.index,
          this.type,
          this.case,
          this.pageEvent.pageSize,
          this.pageEvent.pageIndex
        ).then(
          response => {
            this.data = response.hits.hits;
            this.total = response.hits.total;
            this.scrollID = response._scroll_id;
            console.log(response);
          }, error => {
            console.error(error);
          }).then(() => {
          console.log('Show Metadata Completed!');
        });
      } else {
        this.es.getPageWithScroll(
          this.index,
          this.type,
          this.case,
          this.pageEvent.pageSize,
          this.pageEvent.pageIndex
        ).then(
          response => {
            this.data = response.hits.hits;
            this.total = response.hits.total;
            this.scrollID = response._scroll_id;
            console.log(response);
          }, error => {
            console.error(error);
          }).then(() => {
          console.log('Show Metadata Completed!');
        });
      }
    }
    this.es.getNextPage(this.scrollID).then(
      response => {
        if (response.hits.hits) {
          this.data = this.data.concat(response.hits.hits);
          this.pageEvent.pageIndex ++;
        } else {
          this.haveNextPage = false;
          this.notice = 'There are no more metadata!';
        }
        console.log(response);
      }, error => {
        console.error(error);
      }).then(() => {
      console.log('Show next page of Metadata Completed!');
    });
  }

  loadPage($event) {
    this.loadingData = true;
    this.pageEvent = $event;
    // let topPaginator = document.querySelector('#topPaginator');
    // let bottomPaginator = document.querySelector('#bottomPaginator');
    // topPaginator.page = this.pageEvent.pageIndex;
    // bottomPaginator.page = this.pageEvent.pageIndex;
    if (this.type === 'aggregated-mactimes') {
      this.es.getAggregatedPage(
        this.index,
        this.type,
        this.case,
        this.pageEvent.pageSize,
        this.pageEvent.pageIndex
      ).then(
        response => {
          this.data = response.hits.hits;
          this.total = response.hits.total;
          this.scrollID = response._scroll_id;
          // console.log(response);
        }, error => {
          console.error(error);
        }).then(() => {
        console.log('Show Metadata Completed!');
        this.loadingData = false;
      });
    } else {
      this.es.getFilteredPage(
        this.index,
        this.type,
        this.case,
        this.pageEvent.pageSize,
        this.pageEvent.pageIndex,
        this.filter,
        this.displayedClusters,
        this.pageSortString,
        this.pageSortOrder,
        Array.from(this.additionalFilters.values())
      ).then(
        response => {
          this.data = response.hits.hits;
          this.total = response.hits.total;
          this.scrollID = response._scroll_id;
          // console.log(response);
        }, error => {
          console.error(error);
        }).then(() => {
        console.log('Show Metadata Completed!');
        this.loadingData = false;
      });
    }
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

  searchByString() {
    console.log('search', this.searchString);
    if  (this.searchString !== '')  {
      this.additionalFilters.set('searchString', this.fs.buildAdditionSearchFilter(this.searchString));
      this.init();
    } else if (this.additionalFilters.has('searchString')) {
      this.additionalFilters.delete('searchString');
      this.init();
    }
  }

  editTableColumns() {
    const dialogRef = this.dialog.open(SelectDialogComponent, {
      width: '350px',
      data: {title: 'Select table columns',
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

  // TODO struktura s predbezne nahranymy daty - napr preload, kde bude +/- 50 vic dat nez v zobrazenych,
  // TODO z toho se budou brat data pro zobrazeni pokud budou v rozsahu. Pokud se budu blizit k hranici, tak nahraju novou strukturu preload
  // Method called by virtual scroll to get visible data.
  loadVisibleData($event) {
    console.log($event);
    const start = $event['start'];
    const end = $event['end'];
    const offset = $event['start'];
    const count = $event['end'] - $event['start'];
    console.log(offset, count);
    console.log(this.virtualArray.length);
    this.visibleDataFirstIndex = start;
    if (this.virtualArray.length > 0) { // get rid of fake loading state if empty
        console.log('preload visible start:', this.preloadVisibleStart);
        this.preloadVisibleStart = start - this.preloadedBegin;
        console.log('preload visible start changed:', this.preloadVisibleStart);
        if (end <= this.preloadedEnd && start >= this.preloadedBegin) {
          this.visibleData = this.preloadedData.slice(
            (start - this.preloadedBegin),
            (end - (this.preloadedBegin) + 1)
          );
          console.log('arr', this.preloadedData[(start - this.preloadedBegin)]);
          if ((start - this.preloadedBegin < this.preloadBufferBorder) && (start > this.preloadBufferBorder)) {
            const begVal = start - this.preloadBufferOffset < 0 ? 0 : start - this.preloadBufferOffset;
            this.preloadData(begVal, this.preloadedBufferSize, null, null, false, true);
          }
          if (this.preloadedEnd - end < this.preloadBufferBorder && this.preloadedEnd < this.total) {
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

  // Method called to preload data to buffer for virtual scroll.
  preloadData(begin, size, visibleDataStart, visibleDataEnd, loadingState: boolean, preloadBuffer: boolean) {
    this.preloadedRequestedBegin = begin;
    console.log('preload data: ', begin, size, loadingState, preloadBuffer);
    if (!this.preloadBufferState && preloadBuffer) {
        console.log('calling preload');
        this.preloadBufferState = true;
        this.dataLoader(begin, size, visibleDataStart, visibleDataEnd, loadingState, preloadBuffer);
    } else {
        setTimeout(() => {
            if (this.preloadedRequestedBegin === begin) {
                this.dataLoader(begin, size, visibleDataStart, visibleDataEnd, loadingState, preloadBuffer);
            }
        }, 300);
    }

  }

  // Method called to load data from database into buffer.
  dataLoader(begin, size, visibleDataStart, visibleDataEnd, loadingState: boolean, preloadBuffer: boolean) {
      if (loadingState) {
          this.loadingData = true;
      }
      this.clusterManager.getData(this.index, this.type, begin, size, this.pageSortString, this.pageSortOrder)
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

  openHighlightedTextMenu(event: TextSelectEvent, index) {
      console.group( 'Text Select Event' );
      console.log( 'Text:', event.text );
      console.log( 'Viewport Rectangle:', event.viewportRectangle );
      console.log( 'Host Rectangle:', event.hostRectangle );
      console.groupEnd();
      this.highlightedTextId = index + this.visibleDataFirstIndex;
      if ( event.hostRectangle ) {

          this.highlightedTextBox = event.hostRectangle;
          this.highlightedText = event.text;
          this.highlightedBox.nativeElement.style.display = 'block';
          this.highlightedBox.nativeElement.style.top = (event.viewportRectangle.top - 35 ) + 'px';
          this.highlightedBox.nativeElement.style.left = event.viewportRectangle.left + 'px';

      } else {
          this.highlightedBox.nativeElement.style.display = 'none';
          this.highlightedTextBox = null;
          this.highlightedText = '';

      }
  }

  makeClusterByHighlight(): void {
    console.log('text', this.highlightedText);
    const computation = new ComputationModel();
    computation.name = this.highlightedText;
    computation.color = '#3d9fea';
    computation.isSelected = true;
    const filter = new FilterModel();
    filter.json = this.fs.buildAdditionSearchFilter(this.highlightedText);
    filter.isSelected = true;
    filter.name = 'highlighted_text';
    filter.type = 'REGEX';
    computation.filters.add(filter);
    this.makeManualCluster.emit(computation);
  }

  skipTheBlockByHighlight(toTheEnd: boolean): void {
        console.log('skip from', this.highlightedTextId, this.visibleDataFirstIndex, this.preloadVisibleStart, this.preloadedBegin);
        let skipIndex = this.highlightedTextId;
        let test = this.highlightedText;
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
            for (let index = (this.highlightedTextId - this.preloadedBegin + 1); index < this.preloadedBufferSize; index++) {
                if (regex.test(this.preloadedData[index]._source['File Name']) === false) {
                    skipIndex = index;
                    break;
                }
            }
        } else {
            for (let index = (this.highlightedTextId - this.preloadedBegin - 1); index >= 0; index--) {
                if (regex.test(this.preloadedData[index]._source['File Name']) === false) {
                    skipIndex = index;
                    break;
                }
            }
        }
        console.log('skip to:', skipIndex + this.preloadedBegin);
        this.virtualScroller.scrollToIndex(skipIndex);
        const hideEvent: TextSelectEvent = {text: ' ', viewportRectangle: null, hostRectangle: null};
        this.openHighlightedTextMenu(hideEvent, 0);
  }
}
