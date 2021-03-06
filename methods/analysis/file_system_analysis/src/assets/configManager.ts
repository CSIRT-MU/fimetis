import * as preparedComputations from './preparedComputations.json';
import * as elasticConfiguration from './elasticConfiguration.json';
import {Injectable} from '@angular/core';


@Injectable()
export class ConfigManager {

    loadPreparedComputations() {
        return preparedComputations;
    }

    loadElasticConfiguration() {
        return elasticConfiguration;
    }


}