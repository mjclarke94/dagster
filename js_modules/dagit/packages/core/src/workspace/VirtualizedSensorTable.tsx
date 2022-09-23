import {gql, useLazyQuery} from '@apollo/client';
import {Box, Caption, Colors} from '@dagster-io/ui';
import {useVirtualizer} from '@tanstack/react-virtual';
import * as React from 'react';
import {Link} from 'react-router-dom';
import styled from 'styled-components/macro';

import {AssetLink} from '../assets/AssetLink';
import {LastRunSummary} from '../instance/LastRunSummary';
import {TickTag, TICK_TAG_FRAGMENT} from '../instigation/InstigationTick';
import {PipelineReference} from '../pipelines/PipelineReference';
import {RUN_TIME_FRAGMENT} from '../runs/RunUtils';
import {humanizeSensorInterval} from '../sensors/SensorDetails';
import {SensorSwitch, SENSOR_SWITCH_FRAGMENT} from '../sensors/SensorSwitch';
import {InstigationType} from '../types/globalTypes';
import {Container, HeaderCell, Inner, Row, RowCell} from '../ui/VirtualizedTable';

import {LoadingOrNone, useDelayedRowQuery} from './VirtualizedWorkspaceTable';
import {isThisThingAJob, useRepository} from './WorkspaceContext';
import {RepoAddress} from './types';
import {SingleSensorQuery, SingleSensorQueryVariables} from './types/SingleSensorQuery';
import {workspacePathFromAddress} from './workspacePath';

type Sensor = {name: string};

interface Props {
  repoAddress: RepoAddress;
  sensors: Sensor[];
}

export const VirtualizedSensorTable: React.FC<Props> = ({repoAddress, sensors}) => {
  const parentRef = React.useRef<HTMLDivElement | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: sensors.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  const totalHeight = rowVirtualizer.getTotalSize();
  const items = rowVirtualizer.getVirtualItems();

  return (
    <>
      <Box
        border={{side: 'horizontal', width: 1, color: Colors.KeylineGray}}
        style={{
          display: 'grid',
          gridTemplateColumns: '76px 38% 30% 10% 20%',
          height: '32px',
          fontSize: '12px',
          color: Colors.Gray600,
        }}
      >
        <HeaderCell />
        <HeaderCell>Sensor name</HeaderCell>
        <HeaderCell>Frequency</HeaderCell>
        <HeaderCell>Last tick</HeaderCell>
        <HeaderCell>Last run</HeaderCell>
      </Box>
      <div style={{overflow: 'hidden'}}>
        <Container ref={parentRef}>
          <Inner $totalHeight={totalHeight}>
            {items.map(({index, key, size, start}) => {
              const row: Sensor = sensors[index];
              return (
                <SensorRow
                  key={key}
                  name={row.name}
                  repoAddress={repoAddress}
                  height={size}
                  start={start}
                />
              );
            })}
          </Inner>
        </Container>
      </div>
    </>
  );
};

interface SensorRowProps {
  name: string;
  repoAddress: RepoAddress;
  height: number;
  start: number;
}

const SensorRow = (props: SensorRowProps) => {
  const {name, repoAddress, start, height} = props;

  const repo = useRepository(repoAddress);

  const [querySensor, queryResult] = useLazyQuery<SingleSensorQuery, SingleSensorQueryVariables>(
    SINGLE_SENSOR_QUERY,
    {
      fetchPolicy: 'cache-and-network',
      variables: {
        selector: {
          repositoryName: repoAddress.name,
          repositoryLocationName: repoAddress.location,
          sensorName: name,
        },
      },
    },
  );

  useDelayedRowQuery(querySensor);
  const {data} = queryResult;

  const sensorData = React.useMemo(() => {
    if (data?.sensorOrError.__typename !== 'Sensor') {
      return null;
    }

    return data.sensorOrError;
  }, [data]);

  return (
    <Row $height={height} $start={start}>
      <RowGrid border={{side: 'bottom', width: 1, color: Colors.KeylineGray}}>
        <RowCell>
          {sensorData ? (
            <Box flex={{direction: 'column', gap: 4}}>
              {/* Keyed so that a new switch is always rendered, otherwise it's reused and animates on/off */}
              <SensorSwitch key={name} repoAddress={repoAddress} sensor={sensorData} />
            </Box>
          ) : null}
        </RowCell>
        <RowCell>
          <Box flex={{direction: 'column', gap: 4}}>
            <span style={{fontWeight: 500}}>
              <Link to={workspacePathFromAddress(repoAddress, `/sensors/${name}`)}>{name}</Link>
            </span>
            {sensorData?.targets && sensorData.targets.length ? (
              <Caption>
                <Box flex={{direction: 'column', gap: 2}}>
                  {sensorData.targets.map((target) => (
                    <PipelineReference
                      key={target.pipelineName}
                      showIcon
                      size="small"
                      pipelineName={target.pipelineName}
                      pipelineHrefContext={repoAddress}
                      isJob={!!(repo && isThisThingAJob(repo, target.pipelineName))}
                    />
                  ))}
                </Box>
              </Caption>
            ) : null}
            {sensorData?.metadata.assetKeys && sensorData.metadata.assetKeys.length ? (
              <Caption>
                <Box flex={{direction: 'column', gap: 2}}>
                  {sensorData.metadata.assetKeys.map((key) => (
                    <AssetLink key={key.path.join('/')} path={key.path} icon="asset" />
                  ))}
                </Box>
              </Caption>
            ) : null}
          </Box>
        </RowCell>
        <RowCell>
          {sensorData ? (
            <div>{humanizeSensorInterval(sensorData.minIntervalSeconds)}</div>
          ) : (
            <LoadingOrNone queryResult={queryResult} />
          )}
        </RowCell>
        <RowCell>
          {sensorData?.sensorState.ticks.length ? (
            <div>
              <TickTag
                tick={sensorData.sensorState.ticks[0]}
                instigationType={InstigationType.SENSOR}
              />
            </div>
          ) : (
            <LoadingOrNone queryResult={queryResult} />
          )}
        </RowCell>
        <RowCell>
          {sensorData?.sensorState && sensorData?.sensorState.runs.length > 0 ? (
            <LastRunSummary
              run={sensorData.sensorState.runs[0]}
              name={name}
              showButton={false}
              showHover
            />
          ) : (
            <LoadingOrNone queryResult={queryResult} />
          )}
        </RowCell>
      </RowGrid>
    </Row>
  );
};

const RowGrid = styled(Box)`
  display: grid;
  grid-template-columns: 76px 38% 30% 10% 20%;
  height: 100%;
`;

const SINGLE_SENSOR_QUERY = gql`
  query SingleSensorQuery($selector: SensorSelector!) {
    sensorOrError(sensorSelector: $selector) {
      ... on Sensor {
        id
        name
        targets {
          pipelineName
        }
        metadata {
          assetKeys {
            path
          }
        }
        minIntervalSeconds
        description
        sensorState {
          id
          runningCount
          ticks(limit: 1) {
            id
            ...TickTagFragment
          }
          runs(limit: 1) {
            id
            ...RunTimeFragment
          }
          nextTick {
            timestamp
          }
        }
        ...SensorSwitchFragment
      }
    }
  }

  ${SENSOR_SWITCH_FRAGMENT}
  ${TICK_TAG_FRAGMENT}
  ${RUN_TIME_FRAGMENT}
`;