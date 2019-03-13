import * as preparedComputations from './preparedComputations.json';
import * as preparedClusters from './preparedClusters.json';
import * as elasticConfiguration from './elasticConfiguration.json';
import {Injectable} from '@angular/core';


@Injectable()
export class ConfigManager {

    loadPreparedComputations() {
        return preparedComputations.default;
    }

    loadPreparedClusters() {
        return preparedClusters.default;
    }

    loadElasticConfiguration() {
        return elasticConfiguration.default;
    }
}
