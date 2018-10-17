import {Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild, AfterViewInit} from '@angular/core';
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
  private SIZE = 25;
  private sub: any;

  @Output('graphChangedBoundary') graphChangedBoundary: EventEmitter<any> = new EventEmitter<any>();

  graphFrequency = 'day';

  searchString = '';
  additionalFilters: Map<string, string> = new Map<string, string>();

  tableSelection = new SelectionModel<any>(true, []);
  availableTableColumns = ['select', 'doctype', 'mode', 'timestamp', 'name', 'type', 'size', 'M-Time', 'A-Time', 'C-Time', 'B-Time', 'id'];
  displayedTableColumns = ['select', 'doctype', 'mode', 'timestamp', 'name', 'type', 'size', 'M-Time', 'A-Time', 'C-Time', 'B-Time', 'id'];
  data: any[];


  haveNextPage = false;
  scrollID = '';
  notice = '';
  total = 0;


  // Virtual scroll
  virtualArray: VirtualArrayModel = new VirtualArrayModel();
  visibleData: any[] = [];
  preloadedData: any[] = [];
  preloadedBegin = 0;
  preloadedRequestedBegin: number;
  preloadedEnd;
  preloadVisibleStart = 0;

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

  constructor(private es: ElasticsearchService, private fs: FilterService, private route: ActivatedRoute, public dialog: MatDialog) {
    this.scrollID = '';
    this.notice = '';
    this.haveNextPage = true;
    this.total = 0;
    this.pageEvent = new PageEvent();
    this.pageEvent.pageIndex = 0;
    this.pageEvent.pageSize = this.SIZE;
    this.clusterManager = new ClusterManager(this.es);
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

  init() {
    this.initDataSet();
    // this.initGraph();
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  initDataSet() {
    this.loadingData = true;
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
    //       this.showGraph.ngOnInit();
    //     }, error => {
    //       console.error(error);
    //     }).then(() => {
    //     console.log('Show Metadata Completed!');
    //     this.loadingData = false;
    //   });
    // } else {
    //   this.es.getFilteredPage2(
    //     this.index,
    //     this.type,
    //     this.case,
    //     this.pageEvent.pageSize,
    //     this.pageEvent.pageIndex,
    //     this.computations,
    //     this.displayedClusters,
    //     this.pageSortString,
    //     this.pageSortOrder,
    //     Array.from(this.additionalFilters.values())
    //   ).then(
    //     response => {
    //       this.data = response.hits.hits;
    //       this.total = response.hits.total;
    //       this.scrollID = response._scroll_id;
    //       this.preloadedData = response.hits.hits;
    //       this.preloadedBegin = 0;
    //       this.preloadedEnd = this.pageEvent.pageSize;
    //       this.virtualArray.length = this.total;
    //     }, error => {
    //       console.error(error);
    //     }).then(() => {
    //     console.log('Show Metadata Completed!');
    //     this.loadingData = false;
    //   });
    // }
      this.clusterManager.additional_filters = Array.from(this.additionalFilters.values());
      this.clusterManager.case = this.case;
      console.log('list clust', this.clusters);
      this.clusterManager.clusters = this.clusters;
      this.clusterManager.getData(this.index, this.type, 0, this.pageEvent.pageSize, this.pageSortString, this.pageSortOrder)
          .then(resp => {
            console.log('??? async called', resp, resp.data, resp.total);
            this.data = resp.data;
            this.total = resp.total;
            this.preloadedData = resp.data;
            this.preloadedBegin = 0;
            this.preloadedEnd = this.pageEvent.pageSize;
            this.virtualArray.length = this.total;
            this.loadingData = false;
          });
  }

  initGraph() {
    let first;
    let last;
    const one_day = 1000 * 60 * 60 * 24;
    this.es.getFilteredPage(
      this.index,
      this.type,
      this.case,
      1,
      0,
      this.filter,
      this.displayedClusters,
      'timestamp',
      'asc',
      Array.from(this.additionalFilters.values())
    ).then(
      response => {
        if (response.hits.total !== 0) {
          first = response.hits.hits[0]._source['@timestamp'];
        } else {
          first = 0;
        }
      }, error => {
        console.error(error);
      }).then(() => {
      console.log('Graph frequency computed first step!');
      this.es.getFilteredPage(
        this.index,
        this.type,
        this.case,
        1,
        0,
        this.filter,
        this.displayedClusters,
        'timestamp',
        'desc',
        Array.from(this.additionalFilters.values())
      ).then(
        response => {
          if (response.hits.total !== 0) {
            last = response.hits.hits[0]._source['@timestamp'];
          } else {
            last = 0;
          }
          if (first !== 0 && last !== 0) {
            const diff = (new Date(last).getTime() - new Date(first).getTime()) / one_day;
            if (diff > 365) {
              this.graphFrequency = 'day';
            }
            if (diff <= 365 && diff > 60) {
              this.graphFrequency = 'hour';
            }
            if (diff <= 60 && diff > 30) {
              this.graphFrequency = 'minute';
            }
            if (diff <= 30) {
              this.graphFrequency = 'second';
            }
          } else {
            this.graphFrequency = 'day';
          }
          this.showGraph._frequency = this.graphFrequency;
          this.showGraph.ngOnInit();
        }, error => {
          console.error(error);
        }).then(() => {
        console.log('Graph frequency computed with frequency: ', this.graphFrequency);
      });
    });
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
    this.initDataSet();
  }

  searchByString() {
    console.log('search', this.searchString);
    if  (this.searchString !== '')  {
      this.additionalFilters.set('searchString', this.fs.buildAdditionSearchFilter(this.searchString));
      this.loadPage(this.pageEvent);
    } else if (this.additionalFilters.has('searchString')) {
      this.additionalFilters.delete('searchString');
      this.loadPage(this.pageEvent);
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
  loadVisibleData($event) {
    console.log($event);
    const start = $event['start'];
    const end = $event['end'];
    const offset = $event['start'];
    const count = $event['end'] - $event['start'];
    console.log(offset, count);
    console.log(this.virtualArray.length);
    this.preloadVisibleStart = start - this.preloadedBegin;
    if (end <= this.preloadedEnd && start >= this.preloadedBegin) {
      this.visibleData = this.preloadedData.slice(
        (start - this.preloadedBegin),
        (end - (this.preloadedBegin) + 1)
      );
      console.log('arr', this.preloadedData[(start - this.preloadedBegin)]);
      if ((start - this.preloadedBegin < 20) && (start > 20)) {
        const begVal = start - 40 < 0 ? 0 : start - 40;
        this.preloadData(begVal, 100, null, null, false);
      }
      if (this.preloadedEnd - end < 20 && this.preloadedEnd < this.total) {
        const begVal = start - 40 < 0 ? 0 : start - 40;
        this.preloadData(begVal, 100, null, null, false);
      }
    } else {
      if (end > this.preloadedEnd) {
        const begVal = end - 60 < 0 ? 0 : end - 60;
        this.preloadData(begVal, 100, start, end, true);
      } else {
        const begVal = start - 40 < 0 ? 0 : start - 40;
        this.preloadData(begVal, 100, start, end, true);
      }
    }
  }

  preloadData(begin, size, visibleDataStart, visibleDataEnd, loadingState: boolean) {
    this.preloadedRequestedBegin = begin;
    setTimeout(() => {
      if (this.preloadedRequestedBegin === begin) {
        if (loadingState) {
            this.loadingData = true;
        }
        this.clusterManager.getData(this.index, this.type, begin, size, this.pageSortString, this.pageSortOrder)
          .then(resp => {
              console.log('??? async called virtual scroll', resp, resp.data, resp.total);
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
        });
        // this.es.getFilteredPageScroll(
        //   this.index,
        //   this.type,
        //   this.case,
        //   size,
        //   begin,
        //   this.filter,
        //   this.displayedClusters,
        //   this.pageSortString,
        //   this.pageSortOrder,
        //   Array.from(this.additionalFilters.values())
        // ).then(
        //   response => {
        //     this.preloadedData = response.hits.hits;
        //     this.preloadedBegin = begin;
        //     this.preloadedEnd = this.preloadedBegin + 100;
        //     if (visibleDataStart != null && visibleDataEnd != null) {
        //       this.visibleData = this.preloadedData.slice(
        //         (visibleDataStart - this.preloadedBegin),
        //         (visibleDataEnd - (this.preloadedBegin) + 1)
        //       );
        //     }
        //   }, error => {
        //     console.error(error);
        //   }).then(() => {
        //   console.log('Preload data - done!');
        //   if (loadingState) {
        //     this.loadingData = false;
        //   }
        // });
      }
    }, 300);

  }
}
