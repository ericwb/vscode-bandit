// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import { Uri, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../../../common/constants';
import * as python from '../../../../common/python';
import { ISettings, getWorkspaceSettings } from '../../../../common/settings';
import * as vscodeapi from '../../../../common/vscodeapi';


suite('Settings Tests', () => {
    suite('getWorkspaceSettings tests', () => {
        let getConfigurationStub: sinon.SinonStub;
        let getInterpreterDetailsStub: sinon.SinonStub;
        let getWorkspaceFoldersStub: sinon.SinonStub;
        let configMock: TypeMoq.IMock<WorkspaceConfiguration>;
        let pythonConfigMock: TypeMoq.IMock<WorkspaceConfiguration>;
        let workspace1: WorkspaceFolder = {
            uri: Uri.file(path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'testWorkspace', 'workspace1')),
            name: 'workspace1',
            index: 0,
        };

        setup(() => {
            getConfigurationStub = sinon.stub(vscodeapi, 'getConfiguration');
            getInterpreterDetailsStub = sinon.stub(python, 'getInterpreterDetails');
            configMock = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
            pythonConfigMock = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
            getConfigurationStub.callsFake((namespace: string, uri: Uri) => {
                if (namespace.startsWith('bandit')) {
                    return configMock.object;
                }
                return pythonConfigMock.object;
            });
            getInterpreterDetailsStub.resolves({ path: undefined });
            getWorkspaceFoldersStub = sinon.stub(vscodeapi, 'getWorkspaceFolders');
            getWorkspaceFoldersStub.returns([workspace1]);
        });

        teardown(() => {
            sinon.restore();
        });

        test('Default Settings test', async () => {
            configMock
                .setup((c) => c.get('args', []))
                .returns(() => [])
                .verifiable(TypeMoq.Times.atLeastOnce());
            configMock
                .setup((c) => c.get('cwd', TypeMoq.It.isAnyString()))
                .returns(() => '${workspaceFolder}')
                .verifiable(TypeMoq.Times.atLeastOnce());
            configMock
                .setup((c) => c.get('path', []))
                .returns(() => [])
                .verifiable(TypeMoq.Times.atLeastOnce());
            configMock
                .setup((c) => c.get('importStrategy', 'useBundled'))
                .returns(() => 'useBundled')
                .verifiable(TypeMoq.Times.atLeastOnce());
            configMock
                .setup((c) => c.get('showNotifications', 'off'))
                .returns(() => 'off')
                .verifiable(TypeMoq.Times.atLeastOnce());

            pythonConfigMock
                .setup((c) => c.get('linting.banditArgs', []))
                .returns(() => [])
                .verifiable(TypeMoq.Times.never());
            pythonConfigMock
                .setup((c) => c.get('linting.banditPath', ''))
                .returns(() => 'bandit')
                .verifiable(TypeMoq.Times.never());

            const settings: ISettings = await getWorkspaceSettings('bandit', workspace1);

            assert.deepStrictEqual(settings.cwd, workspace1.uri.fsPath);
            assert.deepStrictEqual(settings.args, []);
            assert.deepStrictEqual(settings.importStrategy, 'useBundled');
            assert.deepStrictEqual(settings.interpreter, []);
            assert.deepStrictEqual(settings.path, []);
            assert.deepStrictEqual(settings.showNotifications, 'off');

            configMock.verifyAll();
            pythonConfigMock.verifyAll();
        });

        test('Resolver test', async () => {
            configMock
                .setup((c) => c.get<string[]>('args', []))
                .returns(() => ['${userHome}', '${workspaceFolder}', '${workspaceFolder:workspace1}', '${cwd}'])
                .verifiable(TypeMoq.Times.atLeastOnce());
            configMock
                .setup((c) => c.get('cwd', TypeMoq.It.isAnyString()))
                .returns(() => '${fileDirname}')
                .verifiable(TypeMoq.Times.atLeastOnce());
            configMock
                .setup((c) => c.get<string[]>('path', []))
                .returns(() => [
                    '${userHome}/bin/bandit',
                    '${workspaceFolder}/bin/bandit',
                    '${workspaceFolder:workspace1}/bin/bandit',
                    '${cwd}/bin/bandit',
                    '${interpreter}',
                ])
                .verifiable(TypeMoq.Times.atLeastOnce());
            configMock
                .setup((c) => c.get<string[]>('interpreter'))
                .returns(() => [
                    '${userHome}/bin/python',
                    '${workspaceFolder}/bin/python',
                    '${workspaceFolder:workspace1}/bin/python',
                    '${cwd}/bin/python',
                ])
                .verifiable(TypeMoq.Times.atLeastOnce());
            configMock
                .setup((c) => c.get('importStrategy', 'useBundled'))
                .returns(() => 'useBundled')
                .verifiable(TypeMoq.Times.atLeastOnce());
            configMock
                .setup((c) => c.get('showNotifications', 'off'))
                .returns(() => 'off')
                .verifiable(TypeMoq.Times.atLeastOnce());

            pythonConfigMock
                .setup((c) => c.get('linting.banditArgs', []))
                .returns(() => [])
                .verifiable(TypeMoq.Times.never());
            pythonConfigMock
                .setup((c) => c.get('linting.banditPath', ''))
                .returns(() => 'bandit')
                .verifiable(TypeMoq.Times.never());
            pythonConfigMock
                .setup((c) => c.get('linting.cwd'))
                .returns(() => '${userHome}/bin')
                .verifiable(TypeMoq.Times.never());

            const settings: ISettings = await getWorkspaceSettings('bandit', workspace1, true);

            assert.deepStrictEqual(settings.cwd, '${fileDirname}');
            assert.deepStrictEqual(settings.args, [
                process.env.HOME || process.env.USERPROFILE,
                workspace1.uri.fsPath,
                workspace1.uri.fsPath,
                process.cwd(),
            ]);
            assert.deepStrictEqual(settings.path, [
                `${process.env.HOME || process.env.USERPROFILE}/bin/bandit`,
                `${workspace1.uri.fsPath}/bin/bandit`,
                `${workspace1.uri.fsPath}/bin/bandit`,
                `${process.cwd()}/bin/bandit`,
                `${process.env.HOME || process.env.USERPROFILE}/bin/python`,
                `${workspace1.uri.fsPath}/bin/python`,
                `${workspace1.uri.fsPath}/bin/python`,
                `${process.cwd()}/bin/python`,
            ]);
            assert.deepStrictEqual(settings.interpreter, [
                `${process.env.HOME || process.env.USERPROFILE}/bin/python`,
                `${workspace1.uri.fsPath}/bin/python`,
                `${workspace1.uri.fsPath}/bin/python`,
                `${process.cwd()}/bin/python`,
            ]);

            configMock.verifyAll();
            pythonConfigMock.verifyAll();
        });

        test('Legacy Settings test', async () => {
            configMock
                .setup((c) => c.get('args', []))
                .returns(() => [])
                .verifiable(TypeMoq.Times.atLeastOnce());
            configMock
                .setup((c) => c.get('cwd', TypeMoq.It.isAnyString()))
                .returns(() => '${userHome}/bin')
                .verifiable(TypeMoq.Times.atLeastOnce());
            configMock
                .setup((c) => c.get('path', []))
                .returns(() => [])
                .verifiable(TypeMoq.Times.atLeastOnce());
            configMock
                .setup((c) => c.get('importStrategy', 'useBundled'))
                .returns(() => 'useBundled')
                .verifiable(TypeMoq.Times.atLeastOnce());
            configMock
                .setup((c) => c.get('showNotifications', 'off'))
                .returns(() => 'off')
                .verifiable(TypeMoq.Times.atLeastOnce());

            pythonConfigMock
                .setup((c) => c.get<string[]>('linting.banditArgs', []))
                .returns(() => ['${userHome}', '${workspaceFolder}', '${workspaceFolder:workspace1}', '${cwd}'])
                .verifiable(TypeMoq.Times.never());
            pythonConfigMock
                .setup((c) => c.get('linting.banditPath', ''))
                .returns(() => '${userHome}/bin/bandit')
                .verifiable(TypeMoq.Times.never());
            pythonConfigMock
                .setup((c) => c.get('linting.cwd'))
                .returns(() => '${userHome}/bin2')
                .verifiable(TypeMoq.Times.never());

            const settings: ISettings = await getWorkspaceSettings('bandit', workspace1);

            assert.deepStrictEqual(settings.cwd, `${process.env.HOME || process.env.USERPROFILE}/bin`);
            // Legacy args should not be read anymore. They are deprecated.
            assert.deepStrictEqual(settings.args, []);
            assert.deepStrictEqual(settings.importStrategy, 'useBundled');
            assert.deepStrictEqual(settings.interpreter, []);
            // Legacy args should not be read anymore. They are deprecated.
            assert.deepStrictEqual(settings.path, []);
            assert.deepStrictEqual(settings.showNotifications, 'off');

            configMock.verifyAll();
            pythonConfigMock.verifyAll();
        });
    });
});
