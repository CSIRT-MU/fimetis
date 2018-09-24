import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {MatPaginator, PageEvent} from '@angular/material';

import { ElasticsearchService } from '../../elasticsearch.service';
import {Metadata} from '../../models/metadata.model';
import {ActivatedRoute} from '@angular/router';

@Component({
  selector: 'show-case',
  templateUrl: './show-case.component.html',
  styleUrls: ['./show-case.component.css']
})
export class ShowCaseComponent implements OnInit, OnDestroy {

  private static readonly INDEX = 'metadata';
  private static readonly SIZE = 10;
  private sub: any;

  type: string;

  data: Metadata[];
  haveNextPage = false;
  scrollID = '';
  notice = '';
  total = 0;

  pageSizeOptions: number[] = [5, 10, 25, 100, 500, 1000];
  pageEvent: PageEvent;

  @ViewChild(MatPaginator) topPaginator: MatPaginator;
  @ViewChild(MatPaginator) bottomPaginator: MatPaginator;

  constructor(private es: ElasticsearchService, private route: ActivatedRoute) {
    this.scrollID = '';
    this.notice = '';
    this.haveNextPage = true;
    this.total = 0;
    this.pageEvent = new PageEvent();
    this.pageEvent.pageIndex = 0;
    this.pageEvent.pageSize = ShowCaseComponent.SIZE;
  }

  ngOnInit() {
    this.sub = this.route.params.subscribe(params => {
      this.type = params['type'];
      console.log(this.type);
      this.es.getCases(
        ShowCaseComponent.INDEX,
        this.type,
      ).then(
        response => {
          this.data = response.aggregations.cases.buckets;
          this.total = this.data.length;
          this.scrollID = response._scroll_id;
          console.log(response);
          console.log(this.data);
        }, error => {
          console.error(error);
        }).then(() => {
        console.log('Show Metadata Completed!');
      });
    });
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  showNextPage() {
    this.es.getNextPage(this.scrollID).then(
      response => {
        this.data = response.hits.hits;
        this.pageEvent.pageIndex ++;
        if (!response.hits.hits) {
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
    this.pageEvent = $event;
    // let topPaginator = document.querySelector('#topPaginator');
    // let bottomPaginator = document.querySelector('#bottomPaginator');
    // topPaginator.page = this.pageEvent.pageIndex;
    // bottomPaginator.page = this.pageEvent.pageIndex;
      this.es.getCases(
      ShowCaseComponent.INDEX,
      this.type
    ).then(
      response => {
        this.data = response.aggregations.cases.buckets;
        this.total = this.data.length;
        this.scrollID = response._scroll_id;
        console.log(response);
      }, error => {
        console.error(error);
      }).then(() => {
      console.log('Show cases Completed!');
    });
  }

  setPageSizeOptions(setPageSizeOptionsInput: string) {
    this.pageSizeOptions = setPageSizeOptionsInput.split(',').map(str => +str);
  }
}
