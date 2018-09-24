import { Component, OnInit, Input } from '@angular/core';
import {Router} from '@angular/router';

@Component({
  selector: 'detail-case',
  templateUrl: './detail-case.component.html',
  styleUrls: ['./detail-case.component.css']
})
export class DetailCaseComponent implements OnInit {

  @Input() case: any;
  @Input() type: any;

  constructor(private router: Router) { }

  ngOnInit() {
  }

  openCase($caseName){
    console.log($caseName);
    this.router.navigate(['/metadata', this.type,   $caseName]);
  }

}
