import * as preparedClusters from './preparedClusters.json';
import {Injectable} from '@angular/core';

@Injectable()
export class ConfigManager {

    loadPreparedClusters() {
        return preparedClusters.default;
    }
}
