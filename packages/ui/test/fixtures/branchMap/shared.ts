import type {BranchMap} from './types.js';
/** Shared (neither shell) scanned branches, drawn on both skins, mapped to the view each one is, or sits inside. Phone view ids are used where a view exists per skin. */
export const SHARED_BRANCH_MAP:BranchMap={
  'conditional-branch-c30b881777091cc0':{kind:'view',view:'shared/field-catalogue'}, // App.vue:157
  'conditional-branch-f00473ae100ea10b':{kind:'notAView',reason:'skin switch that mounts the phone shell'}, // App.vue:158
  'conditional-branch-1cd7b2da45fdd08a':{kind:'notAView',reason:'skin switch that mounts the desktop shell'}, // App.vue:159
  'conditional-branch-12ce47daaa3ff493':{kind:'partOf',view:'wizard-sealed-1'}, // App.vue:161
  'conditional-branch-737196ac152559f5':{kind:'partOf',view:'desktop/projects/new/closed-box/choose-driver'}, // App.vue:162
  'surface-root-60f930417ab5d2e2':{kind:'partOf',view:'editor-general'}, // App.vue:165
  'conditional-branch-f43ac0c6df9acac9':{kind:'partOf',view:'desktop/results/what-if/closed-box'}, // App.vue:166
  'conditional-branch-5d06f804709cccc8':{kind:'view',view:'shared/flash-message'}, // App.vue:170
  'surface-root-a7ef3b25011bb13c':{kind:'partOf',view:'menu-diagnosticsmodal'}, // App.vue:174
  'surface-root-5403400e1fdb361a':{kind:'partOf',view:'menu-splashmodal'}, // App.vue:176
  'surface-root-a321f3e72f81713f':{kind:'partOf',view:'menu-announcementsmodal'}, // App.vue:178
  'surface-root-bd4d79550017fe67':{kind:'partOf',view:'menu-winisddifferencesmodal'}, // App.vue:180
  'imperative-ui-891ef337091a37f4':{kind:'view',view:'shared/chart-readout'}, // canvas.ts:209
  'imperative-ui-05d81ad62246950f':{kind:'partOf',view:'shared/chart-readout'}, // canvas.ts:237
  'conditional-branch-e0e0b1b011c77c89':{kind:'partOf',view:'phone/difference-cue'}, // components/AdvancedOptions.vue:30
  'surface-root-6720ff0276e2bf27':{kind:'view',view:'menu-announcementsmodal'}, // components/AnnouncementsModal.vue:13
  'surface-root-01b2ab0599cd59bf':{kind:'view',view:'menu-announcementsmodal'}, // components/AnnouncementsModal.vue:14
  'conditional-branch-3d59d5cf8eebd169':{kind:'partOf',view:'menu-announcementsmodal'}, // components/AnnouncementsModal.vue:18
  'conditional-branch-e8e8b17a103cd622':{kind:'view',view:'announcements-current'}, // components/AnnouncementsModal.vue:24
  'conditional-branch-8e88533ef704ecc9':{kind:'partOf',view:'menu-announcementsmodal'}, // components/AnnouncementsModal.vue:32
  'conditional-branch-93627c502177a1cb':{kind:'partOf',view:'menu-announcementsmodal'}, // components/AnnouncementsModal.vue:39
  'conditional-branch-d89e27668b4c3a11':{kind:'partOf',view:'announcements-current'}, // components/AnnouncementsModal.vue:42
  'conditional-branch-a9a117123bfc19a7':{kind:'partOf',view:'menu-announcementsmodal'}, // components/AnnouncementsModal.vue:46
  'conditional-branch-0c8ce64388dff413':{kind:'partOf',view:'wizard-sealed-3'}, // components/BoxTypeDiagram.vue:13
  'conditional-branch-a2fed5ba51ce8dda':{kind:'partOf',view:'wizard-vented-3'}, // components/BoxTypeDiagram.vue:20
  'conditional-branch-ea440ce6fb794f6c':{kind:'partOf',view:'wizard-box-passive-radiator-3'}, // components/BoxTypeDiagram.vue:30
  'conditional-branch-11d9e6dc07acef12':{kind:'partOf',view:'wizard-bandpass4-3'}, // components/BoxTypeDiagram.vue:39
  'conditional-branch-d935dfb12e814233':{kind:'partOf',view:'wizard-bandpass6-3'}, // components/BoxTypeDiagram.vue:48
  'conditional-branch-de3e97ce0a419218':{kind:'partOf',view:'wizard-abc-3'}, // components/BoxTypeDiagram.vue:64
  'surface-root-5939726e16caa99a':{kind:'view',view:'chart-data'}, // components/ChartDataDialog.vue:14
  'surface-root-7178929b3db332af':{kind:'partOf',view:'chart-data'}, // components/ChartDataDialog.vue:15
  'conditional-branch-a61ce28fb6ea04da':{kind:'notAView',reason:'button inside the chart data dialog'}, // components/ChartDataDialog.vue:17
  'conditional-branch-4dcdaaffefbb7cac':{kind:'notAView',reason:'the port-shape button draws a circle when the port is round'}, // components/PortShapeToggle.vue:16
  'conditional-branch-cf3340014c9c8c33':{kind:'notAView',reason:'the port-shape button draws a slot when the port is slotted'}, // components/PortShapeToggle.vue:17
  'native-ui-ffbecbd209bdaca2':{kind:'notAView',reason:'button inside the chart data dialog'}, // components/ChartDataDialog.vue:29
  'native-ui-65528f8917ccabae':{kind:'notAView',reason:'button inside the chart data dialog'}, // components/ChartDataDialog.vue:30
  'conditional-branch-abedb57a509452a3':{kind:'notAView',reason:'number badge on the cloud sync button'}, // components/CloudSyncBadge.vue:38
  'conditional-branch-4c513b5878c82d74':{kind:'view',view:'cloud'}, // components/CloudSyncDialog.vue:60
  'conditional-branch-c57bafe3881ae99f':{kind:'partOf',view:'cloud'}, // components/CloudSyncDialog.vue:66
  'conditional-branch-32a7edd384ec86d3':{kind:'partOf',view:'cloud'}, // components/CloudSyncDialog.vue:67
  'conditional-branch-27daeef384d69d80':{kind:'partOf',view:'cloud'}, // components/CloudSyncDialog.vue:68
  'conditional-branch-74cb1bf45a196ffc':{kind:'partOf',view:'cloud'}, // components/CloudSyncDialog.vue:72
  'conditional-branch-42f6a358b0c19bba':{kind:'partOf',view:'cloud'}, // components/CloudSyncDialog.vue:76
  'conditional-branch-f5ac6b93c6b72790':{kind:'partOf',view:'cloud'}, // components/CloudSyncDialog.vue:82
  'conditional-branch-4933bbebee2997ab':{kind:'partOf',view:'cloud'}, // components/CloudSyncDialog.vue:93
  'conditional-branch-f134281bfa40a9e0':{kind:'partOf',view:'desktop/settings/cloud/account-and-activity'}, // components/CloudSyncDialog.vue:102
  'conditional-branch-82129c92e7a9b011':{kind:'partOf',view:'desktop/settings/cloud/account-and-activity'}, // components/CloudSyncDialog.vue:105
  'conditional-branch-cf49bf429ddf905b':{kind:'partOf',view:'desktop/settings/cloud/account-and-activity'}, // components/CloudSyncDialog.vue:108
  'conditional-branch-63ba6111fa5d0327':{kind:'partOf',view:'desktop/settings/cloud/account-and-activity'}, // components/CloudSyncDialog.vue:112
  'conditional-branch-ea4a9db5bd01d9b7':{kind:'partOf',view:'desktop/settings/cloud/account-and-activity'}, // components/CloudSyncDialog.vue:126
  'conditional-branch-c90dbf915acc50fc':{kind:'partOf',view:'desktop/settings/cloud/account-and-activity'}, // components/CloudSyncDialog.vue:132
  'surface-root-fa908c212290a1c4':{kind:'view',view:'confirmation'}, // components/ConfirmDialog.vue:42
  'surface-root-cf52d5e30ecb9756':{kind:'partOf',view:'confirmation'}, // components/ConfirmDialog.vue:43
  'conditional-branch-b6e959835c37125e':{kind:'partOf',view:'confirmation'}, // components/ConfirmDialog.vue:47
  'surface-root-b5a83aff9e8f2f36':{kind:'view',view:'crash'}, // components/CrashScreen.vue:8
  'conditional-branch-c54873ad11ba6028':{kind:'notAView',reason:'section header band, a layout wrapper'}, // components/DesktopBand.vue:14
  'conditional-branch-ed79336ec0af37f4':{kind:'notAView',reason:'section header band, a layout wrapper'}, // components/DesktopBand.vue:18
  'surface-root-760eabd6db0d2452':{kind:'view',view:'desktop/help/tab-help-panel'}, // components/DesktopHelpPanel.vue:24
  'conditional-branch-51a5c69f6370b02a':{kind:'partOf',view:'desktop/help/tab-help-panel'}, // components/DesktopHelpPanel.vue:31
  'conditional-branch-b80dc9951bae4d4a':{kind:'partOf',view:'desktop/help/tab-help-panel'}, // components/DesktopHelpPanel.vue:33
  'conditional-branch-e733eeaa5d0a8514':{kind:'partOf',view:'desktop/help/tab-help-panel'}, // components/DesktopHelpPanel.vue:34
  'conditional-branch-4aba11ea249a1499':{kind:'view',view:'menu-diagnosticsmodal'}, // components/DiagnosticsModal.vue:30
  'conditional-branch-ede39a579e10f4b0':{kind:'partOf',view:'diagnostic-repairs'}, // components/DiagnosticsModal.vue:35
  'conditional-branch-9d0532695bcde3a7':{kind:'partOf',view:'diagnostic-repairs'}, // components/DiagnosticsModal.vue:42
  'conditional-branch-650a0b78107282ea':{kind:'partOf',view:'diagnostic-repairs'}, // components/DiagnosticsModal.vue:44
  'conditional-branch-7c991c14182ba898':{kind:'partOf',view:'diagnostic-repairs'}, // components/DiagnosticsModal.vue:46
  'conditional-branch-3e7a839d48430e40':{kind:'partOf',view:'diagnostic-repairs'}, // components/DiagnosticsModal.vue:51
  'conditional-branch-9effed6b3b509a3f':{kind:'partOf',view:'diagnostic-repairs'}, // components/DiagnosticsModal.vue:52
  'conditional-branch-d207ca93c8970a91':{kind:'partOf',view:'menu-diagnosticsmodal'}, // components/DiagnosticsModal.vue:56
  'conditional-branch-8baed1415e62921e':{kind:'partOf',view:'menu-diagnosticsmodal'}, // components/DiagnosticsModal.vue:57
  'conditional-branch-e6819334b96695f9':{kind:'partOf',view:'diagnostic-repairs'}, // components/DiagnosticsModal.vue:64
  'surface-root-5c205b24f98ca615':{kind:'partOf',view:'menu-diagnosticsmodal'}, // components/DiagnosticsModal.vue:73
  'surface-root-3b1293f29157b62b':{kind:'partOf',view:'menu-diagnosticsmodal'}, // components/DiagnosticsModal.vue:74
  'native-ui-9fb2778e980bd2bb':{kind:'notAView',reason:'dismiss button of the diagnostics dialog'}, // components/DiagnosticsModal.vue:77
  'conditional-branch-3a80d22a28fdedca':{kind:'partOf',view:'diagnostic-repairs'}, // components/DiagnosticsModal.vue:80
  'conditional-branch-a58b2dcc0dad58a7':{kind:'partOf',view:'diagnostic-repairs'}, // components/DiagnosticsModal.vue:84
  'conditional-branch-94bc77d27df022ba':{kind:'partOf',view:'menu-diagnosticsmodal'}, // components/DiagnosticsModal.vue:90
  'conditional-branch-11001e5cbdf0f6f8':{kind:'partOf',view:'diagnostic-repairs'}, // components/DiagnosticsModal.vue:96
  'conditional-branch-ad6b6c5fd6cfea99':{kind:'partOf',view:'diagnostic-repairs'}, // components/DiagnosticsModal.vue:98
  'conditional-branch-2e48d3ea2e88ae51':{kind:'partOf',view:'diagnostic-repairs'}, // components/DiagnosticsModal.vue:102
  'conditional-branch-13e3902c8f501e88':{kind:'partOf',view:'diagnostic-repairs'}, // components/DiagnosticsModal.vue:110
  'conditional-branch-6aa3876c10e627dd':{kind:'partOf',view:'diagnostic-repairs'}, // components/DiagnosticsModal.vue:111
  'conditional-branch-3e58cc4815992311':{kind:'partOf',view:'menu-diagnosticsmodal'}, // components/DiagnosticsModal.vue:114
  'conditional-branch-f328ebf3736e4142':{kind:'partOf',view:'menu-diagnosticsmodal'}, // components/DiagnosticsModal.vue:118
  'conditional-branch-31f5c1baea54ac17':{kind:'partOf',view:'menu-diagnosticsmodal'}, // components/DiagnosticsModal.vue:121
  'conditional-branch-39b37e70ae3313cb':{kind:'partOf',view:'diagnostic-repairs'}, // components/DiagnosticsModal.vue:136
  'surface-root-237f7cb5a6b6e0ea':{kind:'view',view:'driver-storage-error'}, // components/DriverBrowser.vue:44
  'surface-root-d0678b75fd7ab49f':{kind:'partOf',view:'driver-storage-error'}, // components/DriverBrowser.vue:45
  'conditional-branch-c4fd3a41ed16bf4a':{kind:'view',view:'shared/driver-delete-challenge-warning'}, // components/DriverBrowser.vue:65
  'surface-root-7ef5d415fc2fd6a3':{kind:'view',view:'driver-picker'}, // components/DriverBrowser.vue:71
  'surface-root-59f7d487da7c3b15':{kind:'partOf',view:'driver-picker'}, // components/DriverBrowser.vue:72
  'native-ui-c382f453397ca34c':{kind:'notAView',reason:'close button of the driver browser'}, // components/DriverBrowser.vue:75
  'conditional-branch-b989dd12d68f1ae3':{kind:'notAView',reason:'summary button that opens the driver disagreements list'}, // components/DriverConsistencyList.vue:12
  'surface-root-45df5e0dad260e9f':{kind:'partOf',view:'editor-general'}, // components/DriverEditorModal.vue:703
  'surface-root-f94135dc62e865bf':{kind:'partOf',view:'editor-general'}, // components/DriverEditorModal.vue:704
  'native-ui-2bba9f9bd34d1c4b':{kind:'notAView',reason:'help or close button of the driver editor'}, // components/DriverEditorModal.vue:705
  'native-ui-bcf0cdec26b357a9':{kind:'notAView',reason:'help or close button of the driver editor'}, // components/DriverEditorModal.vue:705
  'surface-root-ad2db4b2ed16ed50':{kind:'partOf',view:'section-help'}, // components/DriverEditorModal.vue:707
  'conditional-branch-b6327ad21082a5d6':{kind:'partOf',view:'editor-general'}, // components/DriverEditorModal.vue:713
  'conditional-branch-a9cdd6b114605fb9':{kind:'view',view:'editor-general'}, // components/DriverEditorModal.vue:720
  'conditional-branch-64da68131a3d95fc':{kind:'partOf',view:'editor-general'}, // components/DriverEditorModal.vue:723
  'conditional-branch-ab106a8dc4990e67':{kind:'partOf',view:'editor-general'}, // components/DriverEditorModal.vue:726
  'conditional-branch-ff14eac5c4729225':{kind:'partOf',view:'editor-general'}, // components/DriverEditorModal.vue:732
  'conditional-branch-38a18ddd3fdbd7ea':{kind:'partOf',view:'editor-general'}, // components/DriverEditorModal.vue:735
  'conditional-branch-6503627ecc201f62':{kind:'view',view:'editor-parameters'}, // components/DriverEditorModal.vue:742
  'conditional-branch-c390ed4038fc77d6':{kind:'partOf',view:'editor-parameters'}, // components/DriverEditorModal.vue:744
  'conditional-branch-8b38f9a3d547aa83':{kind:'partOf',view:'editor-parameters'}, // components/DriverEditorModal.vue:745
  'conditional-branch-c390ed4038fc77d6-2':{kind:'partOf',view:'editor-parameters'}, // components/DriverEditorModal.vue:756
  'conditional-branch-8b38f9a3d547aa83-2':{kind:'partOf',view:'editor-parameters'}, // components/DriverEditorModal.vue:757
  'conditional-branch-c390ed4038fc77d6-3':{kind:'partOf',view:'editor-parameters'}, // components/DriverEditorModal.vue:776
  'conditional-branch-8b38f9a3d547aa83-3':{kind:'partOf',view:'editor-parameters'}, // components/DriverEditorModal.vue:777
  'conditional-branch-c390ed4038fc77d6-4':{kind:'partOf',view:'editor-parameters'}, // components/DriverEditorModal.vue:790
  'conditional-branch-8b38f9a3d547aa83-4':{kind:'partOf',view:'editor-parameters'}, // components/DriverEditorModal.vue:791
  'conditional-branch-c85a259ff4d30814':{kind:'view',view:'editor-advanced'}, // components/DriverEditorModal.vue:807
  'conditional-branch-82c9e21f9a102e7c':{kind:'partOf',view:'editor-advanced'}, // components/DriverEditorModal.vue:809
  'conditional-branch-9221a8bbab297f6a':{kind:'partOf',view:'editor-advanced'}, // components/DriverEditorModal.vue:810
  'conditional-branch-82c9e21f9a102e7c-2':{kind:'partOf',view:'editor-advanced'}, // components/DriverEditorModal.vue:819
  'conditional-branch-9221a8bbab297f6a-2':{kind:'partOf',view:'editor-advanced'}, // components/DriverEditorModal.vue:820
  'conditional-branch-82c9e21f9a102e7c-3':{kind:'partOf',view:'editor-advanced'}, // components/DriverEditorModal.vue:836
  'conditional-branch-9221a8bbab297f6a-3':{kind:'partOf',view:'editor-advanced'}, // components/DriverEditorModal.vue:837
  'conditional-branch-f82c94a56585319e':{kind:'view',view:'editor-dimensions'}, // components/DriverEditorModal.vue:846
  'conditional-branch-63d5e9a0ebc63177':{kind:'partOf',view:'editor-dimensions'}, // components/DriverEditorModal.vue:848
  'conditional-branch-7586f29f27db56aa':{kind:'partOf',view:'editor-dimensions'}, // components/DriverEditorModal.vue:849
  'native-ui-2fe0596dca458293':{kind:'partOf',view:'editor-dimensions'}, // components/DriverEditorModal.vue:864
  'conditional-branch-dc8f2246e4d66ee2':{kind:'view',view:'shared/driver-editor-incomplete-warning'}, // components/DriverEditorModal.vue:875
  'conditional-branch-67bd860bb45131c3':{kind:'partOf',view:'shared/driver-editor-incomplete-warning'}, // components/DriverEditorModal.vue:882
  'conditional-branch-ac7c251470b91f7c':{kind:'partOf',view:'shared/driver-editor-incomplete-warning'}, // components/DriverEditorModal.vue:889
  'surface-root-eb28b7ecda38e68d':{kind:'partOf',view:'equations'}, // components/DriverEditorModal.vue:900
  'conditional-branch-d5a7560ed8af1d7c':{kind:'partOf',view:'driver-dq'}, // components/DriverEditorModal.vue:911
  'conditional-branch-232a9cdefd48dd15':{kind:'partOf',view:'driver-dq'}, // components/DriverEditorModal.vue:915
  'conditional-branch-7d07571234e1d490':{kind:'notAView',reason:'toolbar or button row of the driver editor'}, // components/DriverEditorModal.vue:920
  'native-ui-287bca5fd7cdf9be':{kind:'notAView',reason:'toolbar or button row of the driver editor'}, // components/DriverEditorModal.vue:921
  'native-ui-a671fee4b511eb21':{kind:'notAView',reason:'toolbar or button row of the driver editor'}, // components/DriverEditorModal.vue:925
  'conditional-branch-618af16452c61256':{kind:'notAView',reason:'toolbar or button row of the driver editor'}, // components/DriverEditorModal.vue:932
  'native-ui-13e83a34ce330e10':{kind:'notAView',reason:'toolbar or button row of the driver editor'}, // components/DriverEditorModal.vue:938
  'conditional-branch-b5dddd405999d819':{kind:'notAView',reason:'toolbar or button row of the driver editor'}, // components/DriverEditorModal.vue:939
  'native-ui-104165b8674f70cc':{kind:'notAView',reason:'Export or Import button, a trigger for the file step'}, // components/DriverEditorModal.vue:941
  'native-ui-b553a03c73f043bc':{kind:'notAView',reason:'Export or Import button, a trigger for the file step'}, // components/DriverEditorModal.vue:942
  'conditional-branch-2391a9eb5cfea6d1':{kind:'notAView',reason:'toolbar or button row of the driver editor'}, // components/DriverEditorModal.vue:949
  'native-ui-851aaafa15bb6011':{kind:'notAView',reason:'toolbar or button row of the driver editor'}, // components/DriverEditorModal.vue:950
  'conditional-branch-b3824d2e7efdd8e8':{kind:'notAView',reason:'toolbar or button row of the driver editor'}, // components/DriverEditorModal.vue:951
  'conditional-branch-c823db5a1c4159e5':{kind:'notAView',reason:'toolbar or button row of the driver editor'}, // components/DriverEditorModal.vue:954
  'conditional-branch-34819158e2522016':{kind:'notAView',reason:'toolbar or button row of the driver editor'}, // components/DriverEditorModal.vue:955
  'conditional-branch-3176c9705585d6ce':{kind:'notAView',reason:'toolbar or button row of the driver editor'}, // components/DriverEditorModal.vue:956
  'conditional-branch-b16ba0cbd2ccc306':{kind:'notAView',reason:'toolbar or button row of the driver editor'}, // components/DriverEditorModal.vue:957
  'conditional-branch-3886f18d921e7dee':{kind:'partOf',view:'driver-more'}, // components/DriverEditorModal.vue:960
  'surface-root-ef6a6d1900d63646':{kind:'view',view:'driver-more'}, // components/DriverEditorModal.vue:961
  'surface-root-05f2507f77a57834':{kind:'partOf',view:'driver-more'}, // components/DriverEditorModal.vue:962
  'native-ui-be9db13e2e71dacd':{kind:'partOf',view:'driver-more'}, // components/DriverEditorModal.vue:963
  'native-ui-c9d9a666a0443462':{kind:'partOf',view:'driver-more'}, // components/DriverEditorModal.vue:964
  'native-ui-15ad7e793ed54ff2':{kind:'partOf',view:'driver-more'}, // components/DriverEditorModal.vue:965
  'native-ui-74fe0fc78ffed1f3':{kind:'partOf',view:'driver-more'}, // components/DriverEditorModal.vue:966
  'surface-root-2acc53c9551d7d95':{kind:'view',view:'driver-identity'}, // components/DriverEditorModal.vue:977
  'surface-root-1a4ac795f8c64261':{kind:'partOf',view:'driver-identity'}, // components/DriverEditorModal.vue:978
  'surface-root-76369fb842b7166d':{kind:'view',view:'driver-export'}, // components/DriverEditorModal.vue:993
  'surface-root-cfcd786a07c7249c':{kind:'partOf',view:'driver-export'}, // components/DriverEditorModal.vue:994
  'surface-root-2737b640fdbf5253':{kind:'view',view:'driver-rename'}, // components/DriverEditorModal.vue:1011
  'surface-root-a89fd345c0b7a420':{kind:'partOf',view:'driver-rename'}, // components/DriverEditorModal.vue:1012
  'conditional-branch-f4644cb22f8a0e30':{kind:'view',view:'driver-save'}, // components/DriverEditorModal.vue:1024
  'surface-root-6bbfe36226c98f96':{kind:'partOf',view:'equations'}, // components/DriverEditorModal.vue:1029
  'conditional-branch-fce69b0d6ce0abe3':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:90
  'conditional-branch-10781a1833fde6f7':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:91
  'conditional-branch-f3fb2c45237ad8f6':{kind:'partOf',view:'driver-search-filters'}, // components/DriverLibrary.vue:99
  'conditional-branch-10ee5cf3c1eb998e':{kind:'partOf',view:'driver-search-filters'}, // components/DriverLibrary.vue:100
  'conditional-branch-b40dbfbeee297319':{kind:'partOf',view:'driver-search-filters'}, // components/DriverLibrary.vue:110
  'native-ui-3cb7035016e82ad3':{kind:'notAView',reason:'help button, a trigger for the driver type help'}, // components/DriverLibrary.vue:115
  'conditional-branch-3417db50cbc18efc':{kind:'view',view:'shared/driver-type-help'}, // components/DriverLibrary.vue:119
  'surface-root-6dcebfb41f9ab057':{kind:'partOf',view:'shared/driver-type-help'}, // components/DriverLibrary.vue:131
  'native-ui-a3ca77763a34c58b':{kind:'partOf',view:'driver-search-filters'}, // components/DriverLibrary.vue:138
  'native-ui-f658696ac0dd8f53':{kind:'partOf',view:'driver-search-filters'}, // components/DriverLibrary.vue:140
  'native-ui-c9adbfbacf5a087d':{kind:'partOf',view:'driver-search-filters'}, // components/DriverLibrary.vue:146
  'native-ui-4d5ef6c0bf9234d4':{kind:'partOf',view:'driver-search-filters'}, // components/DriverLibrary.vue:148
  'conditional-branch-22facbfec2d095d4':{kind:'partOf',view:'driver-search-filters'}, // components/DriverLibrary.vue:152
  'native-ui-242802d2b42ff00b':{kind:'partOf',view:'driver-search-filters'}, // components/DriverLibrary.vue:153
  'native-ui-8d655140b1254c08':{kind:'partOf',view:'driver-search-filters'}, // components/DriverLibrary.vue:160
  'native-ui-6954141802eaef94':{kind:'partOf',view:'driver-search-filters'}, // components/DriverLibrary.vue:162
  'conditional-branch-9d4b25d60de34c5e':{kind:'partOf',view:'driver-search-filters'}, // components/DriverLibrary.vue:199
  'conditional-branch-23db530ed416aad7':{kind:'notAView',reason:'clear-filters button'}, // components/DriverLibrary.vue:202
  'conditional-branch-b8c2be713f2b1339':{kind:'notAView',reason:'clear-filters button'}, // components/DriverLibrary.vue:205
  'native-ui-28e4e5d999786984':{kind:'notAView',reason:'clear-filters button'}, // components/DriverLibrary.vue:208
  'conditional-branch-7e64e597ccbd2b3c':{kind:'view',view:'shared/driver-library-storage-note'}, // components/DriverLibrary.vue:214
  'conditional-branch-46c0f13914b06ec0':{kind:'partOf',view:'driver-storage-error'}, // components/DriverLibrary.vue:217
  'conditional-branch-eb88537c4a8b4781':{kind:'view',view:'shared/driver-library-broken-entry'}, // components/DriverLibrary.vue:221
  'native-ui-139f119c6e133900':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:225
  'conditional-branch-50e243655ef0cd39':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:233
  'conditional-branch-2a77e5f67a6e932e':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:239
  'native-ui-74278c3614a1814e':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:243
  'native-ui-592ed351faabaf9e':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:245
  'conditional-branch-3d9533df3d4f22e0':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:253
  'conditional-branch-9ac211a83baa680b':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:257
  'conditional-branch-1e0a41a1859cfcce':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:260
  'conditional-branch-d5efb4d3d2505008':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:262
  'conditional-branch-1093487408badd3a':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:264
  'conditional-branch-48859ee5cc61579b':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:272
  'conditional-branch-351bd205ac1943c4':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:274
  'conditional-branch-54ddc114194bee19':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:276
  'conditional-branch-8f7655cb4e19622d':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:279
  'conditional-branch-331e20ca3a95429c':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:282
  'conditional-branch-e2ee3786e80068ea':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:292
  'native-ui-9f79c72f768a3afe':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:294
  'conditional-branch-fa61a5d19660897b':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:302
  'conditional-branch-49f9a8f36a11291e':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:303
  'conditional-branch-f0ab409c1066b720':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:305
  'conditional-branch-4b13a434cd324ab3':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:307
  'conditional-branch-619ef214cc74d965':{kind:'view',view:'driver-summary-manage'}, // components/DriverLibrary.vue:315
  'conditional-branch-bdaa9783417038cc':{kind:'partOf',view:'driver-summary-manage'}, // components/DriverLibrary.vue:316
  'conditional-branch-2ac8b8c3a55a64f2':{kind:'partOf',view:'driver-summary-manage'}, // components/DriverLibrary.vue:321
  'conditional-branch-4c613a4790f75c71':{kind:'partOf',view:'driver-summary-manage'}, // components/DriverLibrary.vue:323
  'conditional-branch-2e610570915559ff':{kind:'partOf',view:'driver-summary-manage'}, // components/DriverLibrary.vue:332
  'conditional-branch-6bf00e0f5b4c5b98':{kind:'partOf',view:'driver-summary-manage'}, // components/DriverLibrary.vue:336
  'conditional-branch-058698c354c66914':{kind:'partOf',view:'driver-summary-manage'}, // components/DriverLibrary.vue:341
  'conditional-branch-e1d89dc720a47589':{kind:'partOf',view:'driver-summary-manage'}, // components/DriverLibrary.vue:343
  'conditional-branch-d00757b5dda61717':{kind:'partOf',view:'driver-summary-manage'}, // components/DriverLibrary.vue:346
  'conditional-branch-e8400ce907026677':{kind:'partOf',view:'driver-summary-manage'}, // components/DriverLibrary.vue:349
  'conditional-branch-62e1d7c580ec8bbf':{kind:'partOf',view:'driver-summary-manage'}, // components/DriverLibrary.vue:352
  'conditional-branch-f824840f4a5ef434':{kind:'partOf',view:'driver-summary-manage'}, // components/DriverLibrary.vue:355
  'conditional-branch-367664b4caaf0d8f':{kind:'partOf',view:'driver-summary-manage'}, // components/DriverLibrary.vue:358
  'conditional-branch-a3afe16c73662592':{kind:'partOf',view:'driver-summary-manage'}, // components/DriverLibrary.vue:361
  'conditional-branch-fcab156f7a2cf83c':{kind:'partOf',view:'driver-summary-manage'}, // components/DriverLibrary.vue:364
  'conditional-branch-7de28d149d227620':{kind:'partOf',view:'driver-summary-manage'}, // components/DriverLibrary.vue:367
  'conditional-branch-22436b88526230a1':{kind:'partOf',view:'driver-info'}, // components/DriverLibrary.vue:374
  'conditional-branch-714a371557511550':{kind:'partOf',view:'driver-info'}, // components/DriverLibrary.vue:375
  'conditional-branch-6971ede393ad9421':{kind:'partOf',view:'driver-info'}, // components/DriverLibrary.vue:376
  'conditional-branch-2fbf4082b7f36670':{kind:'partOf',view:'driver-summary-manage'}, // components/DriverLibrary.vue:378
  'native-ui-566a618eb6e039ec':{kind:'partOf',view:'driver-summary-manage'}, // components/DriverLibrary.vue:379
  'native-ui-ad37da4fc834f134':{kind:'partOf',view:'driver-summary-manage'}, // components/DriverLibrary.vue:381
  'conditional-branch-4a3330f39908f0a8':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:387
  'native-ui-686501278cd5ab84':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:388
  'native-ui-7f124be4b9cb4c89':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:389
  'native-ui-bc540b95486d61c1':{kind:'partOf',view:'driver-picker'}, // components/DriverLibrary.vue:390
  'conditional-branch-f5a696d2ce3d1a5a':{kind:'view',view:'equations'}, // components/EquationInspectorModal.vue:19
  'native-ui-a38c700e855c9483':{kind:'notAView',reason:'close button of the equation inspector'}, // components/EquationInspectorModal.vue:22
  'conditional-branch-4f8204b44e85e0e7':{kind:'partOf',view:'equations'}, // components/EquationInspectorModal.vue:26
  'conditional-branch-3bbad9b003b18f8d':{kind:'partOf',view:'equations'}, // components/EquationInspectorModal.vue:29
  'conditional-branch-78fc1a595460a7bd':{kind:'notAView',reason:'warning-colour mark on a WinISD bug switch'}, // components/ErrorSwitch.vue:28
  'surface-root-2508db2dd58f929d':{kind:'partOf',view:'exports'}, // components/ExportMenu.vue:33
  'surface-root-260189131055f1e0':{kind:'partOf',view:'exports'}, // components/ExportMenu.vue:34
  'surface-root-9c7a8556e5cfa2da':{kind:'view',view:'exports'}, // components/ExportMenu.vue:41
  'native-ui-3cae9a7047bcd520':{kind:'partOf',view:'exports'}, // components/ExportMenu.vue:42
  'native-ui-3eccd101c51d219a':{kind:'partOf',view:'exports'}, // components/ExportMenu.vue:43
  'native-ui-f79642f44d663bf4':{kind:'partOf',view:'exports'}, // components/ExportMenu.vue:44
  'native-ui-e643aa5e6e6b1b8c':{kind:'partOf',view:'exports'}, // components/ExportMenu.vue:45
  'native-ui-3f1653bfae556a65':{kind:'partOf',view:'exports'}, // components/ExportMenu.vue:46
  'conditional-branch-6b22366c3dfa5aaa':{kind:'partOf',view:'shared/field-catalogue'}, // components/FieldCatalogue.vue:51
  'conditional-branch-62e948490c5d824e':{kind:'partOf',view:'shared/field-catalogue'}, // components/FieldCatalogue.vue:58
  'conditional-branch-bc5126454016c4a3':{kind:'partOf',view:'shared/field-catalogue'}, // components/FieldCatalogue.vue:59
  'conditional-branch-afe53cd3f6276cd9':{kind:'partOf',view:'shared/field-catalogue'}, // components/FieldCatalogue.vue:60
  'conditional-branch-a58ac1fccddce3d7':{kind:'partOf',view:'shared/field-catalogue'}, // components/FieldCatalogue.vue:61
  'conditional-branch-956b660168a1e228':{kind:'partOf',view:'shared/field-catalogue'}, // components/FieldCatalogue.vue:62
  'conditional-branch-9ca50db3469560ff':{kind:'partOf',view:'shared/field-catalogue'}, // components/FieldCatalogue.vue:63
  'conditional-branch-fc38626e2ad6df2f':{kind:'partOf',view:'shared/field-catalogue'}, // components/FieldCatalogue.vue:64
  'conditional-branch-103474f7d4a5d937':{kind:'partOf',view:'shared/field-catalogue'}, // components/FieldCatalogue.vue:65
  'conditional-branch-589a527e832e8bfe':{kind:'partOf',view:'shared/field-catalogue'}, // components/FieldCatalogue.vue:66
  'conditional-branch-053d962eab6598f1':{kind:'partOf',view:'shared/field-catalogue'}, // components/FieldCatalogue.vue:67
  'conditional-branch-0fcdebbef8bec643':{kind:'partOf',view:'shared/field-catalogue'}, // components/FieldCatalogue.vue:68
  'conditional-branch-d57587fb9e07fb3d':{kind:'partOf',view:'shared/field-catalogue'}, // components/FieldCatalogue.vue:69
  'conditional-branch-d8f066abfb54703b':{kind:'partOf',view:'field-dq'}, // components/FieldCatalogue.vue:70
  'conditional-branch-0397b36d5de1101c':{kind:'partOf',view:'phone/difference-cue'}, // components/FieldCatalogue.vue:71
  'conditional-branch-71dab58a8cb11048':{kind:'view',view:'shared/flash-message'}, // components/Flash.vue:7
  'surface-root-93eff157fe47b7cf':{kind:'partOf',view:'tab-graph'}, // components/GraphPanel.vue:346
  'surface-root-c3f5a7b7ffcfbf04':{kind:'partOf',view:'tab-graph'}, // components/GraphPanel.vue:355
  'conditional-branch-25e889c8e13af122':{kind:'partOf',view:'tab-graph'}, // components/GraphPanel.vue:363
  'conditional-branch-9b749fa968a8436f':{kind:'partOf',view:'tab-graph'}, // components/GraphPanel.vue:363
  'conditional-branch-4a401fc089b35504':{kind:'partOf',view:'tab-graph'}, // components/GraphPanel.vue:365
  'conditional-branch-ae26af162f30b769':{kind:'partOf',view:'chart-data'}, // components/GraphPanel.vue:371
  'conditional-branch-a5f4f45eade96e0b':{kind:'view',view:'shared/graph-warning-pill'}, // components/GraphPanel.vue:372
  'native-ui-5600554eae49bd62':{kind:'notAView',reason:'dismiss button of the graph warning pill'}, // components/GraphPanel.vue:375
  'conditional-branch-252cc2515f3da2b0':{kind:'view',view:'shared/graph-blocked-message'}, // components/GraphPanel.vue:378
  'surface-root-b7c451a71a22119e':{kind:'view',view:'shared/graph-context-menu'}, // components/GraphPanel.vue:386
  'native-ui-daaf434cc32ba8a6':{kind:'partOf',view:'shared/graph-context-menu'}, // components/GraphPanel.vue:390
  'native-ui-7a7f5ed32ddeff6e':{kind:'partOf',view:'shared/graph-context-menu'}, // components/GraphPanel.vue:392
  'native-ui-5ab141662b9b1c51':{kind:'partOf',view:'shared/graph-context-menu'}, // components/GraphPanel.vue:393
  'native-ui-a31087378d9bd774':{kind:'partOf',view:'shared/graph-context-menu'}, // components/GraphPanel.vue:394
  'native-ui-8747237d567389e2':{kind:'partOf',view:'shared/graph-context-menu'}, // components/GraphPanel.vue:395
  'conditional-branch-e39ffce3db5dbab3':{kind:'partOf',view:'shared/graph-context-menu'}, // components/GraphPanel.vue:396
  'conditional-branch-841690e271b9fcb6':{kind:'partOf',view:'shared/graph-context-menu'}, // components/GraphPanel.vue:399
  'conditional-branch-a3fe4632e7a15126':{kind:'partOf',view:'shared/graph-context-menu'}, // components/GraphPanel.vue:401
  'native-ui-c24908810ba01971':{kind:'partOf',view:'wizard-box-passive-radiator-4'}, // components/NewProjectPassiveRadiatorStep.vue:35
  'conditional-branch-345e9c03efbd6504':{kind:'partOf',view:'pr-picker'}, // components/NewProjectPassiveRadiatorStep.vue:36
  'conditional-branch-480dd8de08afa695':{kind:'partOf',view:'wizard-box-passive-radiator-4'}, // components/NewProjectPassiveRadiatorStep.vue:40
  'conditional-branch-7a9badb19051eb02':{kind:'partOf',view:'wizard-box-passive-radiator-4'}, // components/NewProjectPassiveRadiatorStep.vue:44
  'surface-root-c5eb25c6c72810af':{kind:'notAView',reason:'number box internals: unit label, stepper buttons and mnemonic underline'}, // components/NumInput.vue:40
  'conditional-branch-8a410f2fde42091f':{kind:'notAView',reason:'number box internals: unit label, stepper buttons and mnemonic underline'}, // components/NumInput.vue:42
  'conditional-branch-6fdd0300b5b80205':{kind:'notAView',reason:'number box internals: unit label, stepper buttons and mnemonic underline'}, // components/NumInput.vue:43
  'native-ui-d0c9eeaf42eb8054':{kind:'notAView',reason:'number box internals: unit label, stepper buttons and mnemonic underline'}, // components/NumInput.vue:44
  'native-ui-9dfab5604aee4318':{kind:'notAView',reason:'number box internals: unit label, stepper buttons and mnemonic underline'}, // components/NumInput.vue:47
  'conditional-branch-1eb56f2708893bb8':{kind:'partOf',view:'options-general'}, // components/OptionsModal.vue:211
  'conditional-branch-095e3017bd88b79f':{kind:'view',view:'shared/options-error'}, // components/OptionsModal.vue:216
  'conditional-branch-3893e77f75ef9dea':{kind:'view',view:'options-general'}, // components/OptionsModal.vue:219
  'conditional-branch-683c54b33b287115':{kind:'view',view:'options-limits-help'}, // components/OptionsModal.vue:240
  'conditional-branch-58ae834a106f9d6d':{kind:'view',view:'options-plot-window'}, // components/OptionsModal.vue:263
  'native-ui-b20345d8d5b385a3':{kind:'partOf',view:'native-colour'}, // components/OptionsModal.vue:267
  'native-ui-18434834e573a000':{kind:'notAView',reason:'reset or input control inside an Options tab'}, // components/OptionsModal.vue:275
  'native-ui-bc3c9efa2884c325':{kind:'notAView',reason:'reset or input control inside an Options tab'}, // components/OptionsModal.vue:283
  'conditional-branch-1a4ca58cb6e4258d':{kind:'view',view:'options-your-data'}, // components/OptionsModal.vue:290
  'native-ui-5f75b7e19dea9e11':{kind:'notAView',reason:'reset or input control inside an Options tab'}, // components/OptionsModal.vue:309
  'surface-root-c935a81b6b461a5c':{kind:'partOf',view:'options-general'}, // components/OptionsModal.vue:319
  'surface-root-51e575baf3efa5ac':{kind:'partOf',view:'options-general'}, // components/OptionsModal.vue:320
  'native-ui-c9599611e17484ee':{kind:'notAView',reason:'reset or input control inside an Options tab'}, // components/OptionsModal.vue:321
  'conditional-branch-216905ed352ee9ee':{kind:'partOf',view:'options-general'}, // components/OptionsModal.vue:330
  'native-ui-6ab4452d8d1c5c6c':{kind:'notAView',reason:'reset or input control inside an Options tab'}, // components/OptionsModal.vue:347
  'surface-root-e0901ae83f7f24e6':{kind:'view',view:'options-limits-help'}, // components/OptionsModal.vue:357
  'conditional-branch-b0282a2e20d8c425':{kind:'view',view:'shared/options-error'}, // components/OptionsModal.vue:369
  'native-ui-5735e82f776d644d':{kind:'notAView',reason:'reset or input control inside an Options tab'}, // components/OptionsModal.vue:371
  'native-ui-8dec593cf288dc29':{kind:'notAView',reason:'reset or input control inside an Options tab'}, // components/OptionsModal.vue:377
  'native-ui-c7ac3fce55f5a47e':{kind:'notAView',reason:'reset or input control inside an Options tab'}, // components/OptionsModal.vue:385
  'conditional-branch-582d9cd9696e1028':{kind:'view',view:'options-your-data'}, // components/OptionsModal.vue:391
  'native-ui-f3c0834971826d76':{kind:'partOf',view:'options-your-data'}, // components/OptionsModal.vue:400
  'native-ui-0c1c7366e62fdd4b':{kind:'partOf',view:'options-your-data'}, // components/OptionsModal.vue:403
  'native-ui-5d9a8f70f701967f':{kind:'partOf',view:'options-your-data'}, // components/OptionsModal.vue:411
  'conditional-branch-beb7f653f0af5433':{kind:'view',view:'options-plot-window'}, // components/OptionsModal.vue:415
  'native-ui-7e983e64d1fd780c':{kind:'partOf',view:'options-plot-window'}, // components/OptionsModal.vue:421
  'native-ui-f7d254bb84a0e3ec':{kind:'notAView',reason:'reset or input control inside an Options tab'}, // components/OptionsModal.vue:436
  'native-ui-0e27d0def4425cf2':{kind:'notAView',reason:'reset or input control inside an Options tab'}, // components/OptionsModal.vue:442
  'conditional-branch-ed71c343c83a6f3d':{kind:'partOf',view:'shared/options-error'}, // components/OptionsModal.vue:453
  'conditional-branch-912ac8616c45b88e':{kind:'partOf',view:'wizard-placement'}, // components/PlacementDiagram.vue:13
  'conditional-branch-b03c2f98a60afa86':{kind:'partOf',view:'wizard-placement'}, // components/PlacementDiagram.vue:18
  'surface-root-dcddd1748866bf19':{kind:'view',view:'pr-picker'}, // components/PRBrowser.vue:28
  'surface-root-6725d672783b021d':{kind:'partOf',view:'pr-picker'}, // components/PRBrowser.vue:29
  'native-ui-38702c7f40412bb8':{kind:'notAView',reason:'button in the passive radiator browser'}, // components/PRBrowser.vue:30
  'conditional-branch-ddbc5f6890864423':{kind:'partOf',view:'pr-picker'}, // components/PRBrowser.vue:40
  'conditional-branch-bf80fcf8650296f8':{kind:'partOf',view:'pr-picker'}, // components/PRBrowser.vue:49
  'native-ui-1086f507ff632ade':{kind:'notAView',reason:'button in the passive radiator browser'}, // components/PRBrowser.vue:51
  'native-ui-f94aa571bd04ea44':{kind:'notAView',reason:'button in the passive radiator browser'}, // components/PRBrowser.vue:54
  'conditional-branch-cca4bd9723f0a156':{kind:'partOf',view:'pr-picker'}, // components/PRBrowser.vue:56
  'conditional-branch-8d5930a3ae3325b1':{kind:'partOf',view:'pr-picker'}, // components/PRBrowser.vue:57
  'conditional-branch-bf80fcf8650296f8-2':{kind:'partOf',view:'pr-picker'}, // components/PRBrowser.vue:66
  'conditional-branch-c3c5d44d0f4e5a0d':{kind:'partOf',view:'pr-picker'}, // components/PRBrowser.vue:68
  'native-ui-c7504a7c8eeef940':{kind:'notAView',reason:'button in the passive radiator browser'}, // components/PRBrowser.vue:73
  'native-ui-a57fbb9d7cd7c429':{kind:'notAView',reason:'button in the passive radiator browser'}, // components/PRBrowser.vue:74
  'surface-root-51c92ded0e6cd4f2':{kind:'view',view:'driver-save'}, // components/SaveToLibraryDialog.vue:28
  'surface-root-7186c42dd3d5161b':{kind:'partOf',view:'driver-save'}, // components/SaveToLibraryDialog.vue:29
  'conditional-branch-e4ac024f188e8234':{kind:'partOf',view:'menu-splashmodal'}, // components/SplashContent.vue:32
  'conditional-branch-f78a330b3f38f0cc':{kind:'partOf',view:'menu-splashmodal'}, // components/SplashContent.vue:70
  'surface-root-3a49fc4183d494b6':{kind:'view',view:'menu-splashmodal'}, // components/SplashModal.vue:20
  'surface-root-6d74195cbdff9526':{kind:'partOf',view:'menu-splashmodal'}, // components/SplashModal.vue:21
  'native-ui-ec34de8a28e3133f':{kind:'notAView',reason:'close button of the About dialog'}, // components/SplashModal.vue:24
  'conditional-branch-db97fe02835f7181':{kind:'partOf',view:'about-version'}, // components/SplashModal.vue:28
  'conditional-branch-f1b9758a8629d952':{kind:'partOf',view:'about-version'}, // components/SplashModal.vue:37
  'conditional-branch-851ddd1c9122bd07':{kind:'partOf',view:'options-your-data'}, // components/StorageHistory.vue:30
  'conditional-branch-cdbd6efb7601536e':{kind:'view',view:'shared/storage-warning'}, // components/StorageHistory.vue:32
  'conditional-branch-d768322cac08ae0c':{kind:'view',view:'shared/storage-warning'}, // components/StorageHistory.vue:33
  'conditional-branch-c73633905da8674f':{kind:'partOf',view:'options-your-data'}, // components/StorageHistory.vue:35
  'native-ui-846f721eef26b5c1':{kind:'partOf',view:'options-your-data'}, // components/StorageHistory.vue:46
  'conditional-branch-756b3e1e746264ab':{kind:'partOf',view:'options-your-data'}, // components/StorageHistory.vue:49
  'conditional-branch-c296e8914aa80149':{kind:'partOf',view:'options-your-data'}, // components/StorageHistory.vue:50
  'conditional-branch-8369d3fae567d3b2':{kind:'partOf',view:'options-your-data'}, // components/StorageHistory.vue:52
  'conditional-branch-3e4dface7c642648':{kind:'partOf',view:'options-your-data'}, // components/StorageHistory.vue:58
  'conditional-branch-f07e39e88a60fba9':{kind:'view',view:'shared/storage-restore-picker'}, // components/StorageHistory.vue:65
  'conditional-branch-67b7715e706cec93':{kind:'view',view:'shared/storage-restore-picker'}, // components/StorageHistory.vue:66
  'conditional-branch-f3712d4edae6654a':{kind:'partOf',view:'options-your-data'}, // components/StorageHistory.vue:74
  'conditional-branch-63de774e5831c4b2':{kind:'partOf',view:'options-your-data'}, // components/StorageHistory.vue:88
  'conditional-branch-94bc156b2c55d00d':{kind:'view',view:'shared/storage-warning'}, // components/StorageHistory.vue:91
  'conditional-branch-ccce3b7cad31d19c':{kind:'view',view:'shared/storage-warning'}, // components/StorageHistory.vue:92
  'conditional-branch-50afeeee3c13db53':{kind:'partOf',view:'options-your-data'}, // components/StorageHistory.vue:94
  'native-ui-3ec06f5ee190d7c6':{kind:'partOf',view:'options-your-data'}, // components/StorageHistory.vue:107
  'conditional-branch-f4212f89afa7d283':{kind:'partOf',view:'options-your-data'}, // components/StorageHistory.vue:112
  'conditional-branch-758f61fa47019311':{kind:'partOf',view:'options-your-data'}, // components/StorageHistory.vue:113
  'conditional-branch-e6fd7566c20e8a5d':{kind:'partOf',view:'options-your-data'}, // components/StorageHistory.vue:115
  'conditional-branch-d2e85317c981518c':{kind:'partOf',view:'options-your-data'}, // components/StorageHistory.vue:122
  'conditional-branch-fdf395639e3309e7':{kind:'view',view:'shared/storage-restore-picker'}, // components/StorageHistory.vue:129
  'conditional-branch-7ea5bb6a44807b75':{kind:'view',view:'shared/storage-restore-picker'}, // components/StorageHistory.vue:130
  'conditional-branch-9db7263f57bbdd6f':{kind:'partOf',view:'options-your-data'}, // components/StorageHistory.vue:138
  'surface-root-51ce46e9df251b8f':{kind:'view',view:'shared/store-gate'}, // components/StoreGate.vue:13
  'conditional-branch-a2d5491874e60d34':{kind:'partOf',view:'shared/store-gate'}, // components/StoreGate.vue:15
  'conditional-branch-eb8c5e7677c07a99':{kind:'partOf',view:'shared/store-gate'}, // components/StoreGate.vue:18
  'conditional-branch-bd111a01f3ba247d':{kind:'notAView',reason:'line break inside a switch label'}, // components/ToggleLabel.vue:10
  'conditional-branch-0197a2e459db8220':{kind:'notAView',reason:'toolbar icon drawing, one per button'}, // components/ToolbarIcon.vue:20
  'conditional-branch-e2c9858cbc6bc44a':{kind:'notAView',reason:'toolbar icon drawing, one per button'}, // components/ToolbarIcon.vue:24
  'conditional-branch-bc6d092a00112990':{kind:'notAView',reason:'toolbar icon drawing, one per button'}, // components/ToolbarIcon.vue:29
  'conditional-branch-8dc9cbea5be1bd5b':{kind:'notAView',reason:'toolbar icon drawing, one per button'}, // components/ToolbarIcon.vue:34
  'conditional-branch-1084aeaf0eef0a93':{kind:'notAView',reason:'toolbar icon drawing, one per button'}, // components/ToolbarIcon.vue:39
  'conditional-branch-b19fc56f485bd175':{kind:'notAView',reason:'toolbar icon drawing, one per button'}, // components/ToolbarIcon.vue:44
  'conditional-branch-3869ce4ccfc0cc52':{kind:'notAView',reason:'toolbar icon drawing, one per button'}, // components/ToolbarIcon.vue:50
  'conditional-branch-1611af174c531b0f':{kind:'notAView',reason:'toolbar icon drawing, one per button'}, // components/ToolbarIcon.vue:56
  'conditional-branch-8b972da98dd157c8':{kind:'notAView',reason:'toolbar icon drawing, one per button'}, // components/ToolbarIcon.vue:61
  'conditional-branch-3c6789a6ec1a63ce':{kind:'notAView',reason:'toolbar icon drawing, one per button'}, // components/ToolbarIcon.vue:67
  'conditional-branch-9da79757def0c6cb':{kind:'notAView',reason:'toolbar icon drawing, one per button'}, // components/ToolbarIcon.vue:72
  'conditional-branch-358ed24c2e480803':{kind:'notAView',reason:'toolbar icon drawing, one per button'}, // components/ToolbarIcon.vue:95
  'conditional-branch-655c7378175350c1':{kind:'notAView',reason:'toolbar icon drawing, one per button'}, // components/ToolbarIcon.vue:100
  'conditional-branch-431be4eb6b86ff66':{kind:'notAView',reason:'toolbar icon drawing, one per button'}, // components/ToolbarIcon.vue:104
  'conditional-branch-f6ce79886ebfecef':{kind:'notAView',reason:'toolbar icon drawing, one per button'}, // components/ToolbarIcon.vue:107
  'conditional-branch-1177a084cb8cd861':{kind:'notAView',reason:'toolbar icon drawing, one per button'}, // components/ToolbarIcon.vue:110
  'conditional-branch-a3151fb79b2a0d7c':{kind:'notAView',reason:'toolbar icon drawing, one per button'}, // components/ToolbarIcon.vue:115
  'conditional-branch-74e0c65304324d84':{kind:'notAView',reason:'toolbar icon drawing, one per button'}, // components/ToolbarIcon.vue:119
  'conditional-branch-cbe6db579c684540':{kind:'notAView',reason:'toolbar icon drawing, one per button'}, // components/ToolbarIcon.vue:123
  'conditional-branch-8a283f9e82f99d71':{kind:'partOf',view:'field-dq'}, // components/UIFieldBody.vue:159
  'conditional-branch-59e88cacbde0634a':{kind:'notAView',reason:'field editor variant (read-out, count select, number box, unit toggle)'}, // components/UIFieldBody.vue:164
  'conditional-branch-26eb55d64bb64078':{kind:'notAView',reason:'field editor variant (read-out, count select, number box, unit toggle)'}, // components/UIFieldBody.vue:165
  'conditional-branch-bf8989233588f06b':{kind:'notAView',reason:'field editor variant (read-out, count select, number box, unit toggle)'}, // components/UIFieldBody.vue:169
  'conditional-branch-9f31c098e1132b52':{kind:'notAView',reason:'field editor variant (read-out, count select, number box, unit toggle)'}, // components/UIFieldBody.vue:176
  'conditional-branch-29c09c250db87285':{kind:'partOf',view:'phone/difference-cue'}, // components/UIFieldBody.vue:177
  'conditional-branch-b6e2144d357e42f3':{kind:'partOf',view:'field-dq'}, // components/UIFieldBody.vue:180
  'conditional-branch-590d5e7a62df9000':{kind:'partOf',view:'field-dq'}, // components/UIPickField.vue:21
  'conditional-branch-737a67d82a60d299':{kind:'partOf',view:'phone/difference-cue'}, // components/UIPickField.vue:23
  'conditional-branch-4f8f798df03882ff':{kind:'notAView',reason:'field layout variant'}, // components/VentPortFields.vue:38
  'conditional-branch-83e96b327259750c':{kind:'notAView',reason:'field layout variant'}, // components/VentPortFields.vue:42
  'conditional-branch-d95a98618984dae1':{kind:'notAView',reason:'field layout variant'}, // components/WhatIfBoxField.vue:24
  'conditional-branch-2f757f80a67a2a28':{kind:'notAView',reason:'field layout variant'}, // components/WhatIfBoxField.vue:25
  'conditional-branch-81ba868b74a9fb45':{kind:'view',view:'phone/difference-cue'}, // components/WinisdDeviationCue.vue:17
  'conditional-branch-a58eac4982c418de':{kind:'view',view:'menu-winisddifferencesmodal'}, // components/WinisdDifferencesModal.vue:39
  'conditional-branch-b85727974478f25e':{kind:'partOf',view:'menu-winisddifferencesmodal'}, // components/WinisdDifferencesModal.vue:47
  'conditional-branch-21bdc1080bbf565c':{kind:'view',view:'shared/winisd-difference-entry'}, // components/WinisdDifferencesModal.vue:50
  'surface-root-66d5e518bf30f14c':{kind:'partOf',view:'menu-winisddifferencesmodal'}, // components/WinisdDifferencesModal.vue:60
  'surface-root-7ae4c775b84a1f33':{kind:'partOf',view:'menu-winisddifferencesmodal'}, // components/WinisdDifferencesModal.vue:61
  'native-ui-f0a75b73c892800f':{kind:'notAView',reason:'close button of the differences dialog'}, // components/WinisdDifferencesModal.vue:62
  'conditional-branch-7b15a8b11f4242af':{kind:'partOf',view:'menu-winisddifferencesmodal'}, // components/WinisdDifferencesModal.vue:75
  'surface-root-46e416b0609e9968':{kind:'view',view:'wizard-help'}, // components/WizardHelpSheet.vue:10
  'surface-root-c27f2f6bca6749e0':{kind:'partOf',view:'wizard-help'}, // components/WizardHelpSheet.vue:11
  'conditional-branch-7e253949179e4077':{kind:'partOf',view:'wizard-help'}, // components/WizardHelpSheet.vue:17
  'conditional-branch-3b5b7570a8088a72':{kind:'partOf',view:'wizard-help'}, // components/WizardHelpSheet.vue:18
  'conditional-branch-8355b5f901fdfd65':{kind:'notAView',reason:'info button, a trigger for a wizard info card'}, // components/WizardInfoButton.vue:8
  'conditional-branch-d419845f0b389b27':{kind:'notAView',reason:'info button, a trigger for a wizard info card'}, // components/WizardInfoButton.vue:9
  'surface-root-85947f011e67a2a9':{kind:'view',view:'wizard-ebp'}, // components/WizardInfoCard.vue:12
  'conditional-branch-35eace164ed69982':{kind:'partOf',view:'wizard-ebp'}, // components/WizardInfoCard.vue:15
  'standalone-page-7cd3d6d86ca3b465':{kind:'notAView',reason:'host document that loads the app; the app screens are the views'}, // packages/ui/index.html:1
  'standalone-page-d29873e0b00cdbee':{kind:'view',view:'shared/about-page'}, // packages/ui/about/index.html:1
  'standalone-page-87e618e1833e643a':{kind:'view',view:'shared/install-page'}, // packages/ui/install/index.html:1
  'standalone-page-12dfdce330b8b4e3':{kind:'view',view:'refresh'}, // packages/ui/public/about/refresh/index.html:1
};
