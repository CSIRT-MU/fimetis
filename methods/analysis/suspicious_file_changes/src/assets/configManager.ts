import * as data from './config.json';

//import {Injectable} from '@angular/core';
import { Injectable } from '@angular/core';
//import { Http, Response } from '@angular/http';
// import { Http } from 'angular2/http';
//
// import { Observable } from 'rxjs/Observable';
// import 'rxjs/add/operator/map';
// import 'rxjs/add/operator/catch';
// import 'rxjs/add/observable/throw';
// import * as http from 'http';


@Injectable()
export class ConfigManager {
    // constructor(private http: Http) {
    // }

    // private _config: Object;

    // TODO



    load() {
        //const data = this.http.get('/src/assets/config.json');
        console.log(data);

        return data;
    }


}