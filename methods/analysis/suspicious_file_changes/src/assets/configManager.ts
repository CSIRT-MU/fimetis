import * as data from './config.json';
import {Injectable} from '@angular/core';


@Injectable()
export class ConfigManager {


    load() {
        return data;
    }


}