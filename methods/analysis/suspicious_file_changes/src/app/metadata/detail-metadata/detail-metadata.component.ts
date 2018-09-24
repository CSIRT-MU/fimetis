import {Component, OnInit, Input, Type} from '@angular/core';
import {ElasticsearchService} from '../../elasticsearch.service';
import {ShowMetadataComponent} from '../show-metadata/show-metadata.component';
import {Observable} from 'rxjs';


@Component({
  selector: 'app-detail-metadata',
  templateUrl: './detail-metadata.component.html',
  styleUrls: ['./detail-metadata.component.css']
})
export class DetailMetadataComponent implements OnInit {

  @Input() metadata: any;
  @Input() _index: string;
  @Input() _type: string;

  map = new Map<Type<any>, Observable<any>>();

  constructor(private es: ElasticsearchService) {
  }

  ngOnInit() {
  }

  loadSubEntries(_index, _type, _case, _size, _id) {
    if (!this.map.has(_id)) {
      this.es.getSubEntries(
        _index,
        _type,
        _case,
        _size,
        _id
      ).then(
        response => {
          this.map.set(_id, response.hits.hits);
          // this.data[_id] = response.hits.hits;
          // this.scrollID = response._scroll_id;
          console.log(response);
        }, error => {
          console.error(error);
        }).then(() => {
        console.log('Show Subentries Completed!');
      });
    }
  }

}
