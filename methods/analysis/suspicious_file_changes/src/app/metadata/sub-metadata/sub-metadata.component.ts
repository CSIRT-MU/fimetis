import { Component, OnInit, Input } from '@angular/core';
import {ElasticsearchService} from '../../elasticsearch.service';
import {ShowMetadataComponent} from '../show-metadata/show-metadata.component';


@Component({
  selector: 'app-sub-metadata',
  templateUrl: './sub-metadata.component.html',
  styleUrls: ['./sub-metadata.component.css']
})
export class SubMetadataComponent implements OnInit {

  @Input() metadata: any;

  constructor() { }

  ngOnInit() {
  }

}
