import type {BranchMap} from './types.js';
/** Phone-skin scanned branches (shells/mobile) mapped to the view each one is, or sits inside. */
export const PHONE_BRANCH_MAP:BranchMap={
  'conditional-branch-db6071f90df19925':{kind:'view',view:'phone/difference-cue'}, // PassFields.vue:26
  'conditional-branch-8e5646f9b8f740f2':{kind:'view',view:'phone/response-model-pending-notice'}, // MobileBoxTab.vue:49
  'conditional-branch-f8b23a755b83ec96':{kind:'partOf',view:'box-sealed'}, // MobileBoxTab.vue:58
  'conditional-branch-bc310d2cfa5813e3':{kind:'partOf',view:'box-box-passive-radiator'}, // MobileBoxTab.vue:59
  'conditional-branch-15c5edd8b843066f':{kind:'partOf',view:'box-bandpass4'}, // MobileBoxTab.vue:60
  'conditional-branch-f8b23a755b83ec96-2':{kind:'partOf',view:'box-sealed'}, // MobileBoxTab.vue:61
  'conditional-branch-8f00f48d08299d05':{kind:'notAView',reason:'trigger link that opens the sealed alignment dialog'}, // MobileBoxTab.vue:63
  'conditional-branch-ea7e67f4921dd9d3':{kind:'notAView',reason:'trigger link that opens the vented alignment dialog'}, // MobileBoxTab.vue:64
  'conditional-branch-9379bced08f44eb0':{kind:'partOf',view:'box-bandpass4'}, // MobileBoxTab.vue:70
  'conditional-branch-bb818719ac383649':{kind:'partOf',view:'box-bandpass4'}, // MobileBoxTab.vue:72
  'surface-root-5061c6d38462ed62':{kind:'view',view:'sealed-alignment'}, // MobileBoxTab.vue:81
  'surface-root-67efa6e4f4432666':{kind:'partOf',view:'sealed-alignment'}, // MobileBoxTab.vue:82
  'conditional-branch-3402d597d54383d5':{kind:'view',view:'phone/difference-cue'}, // MobileBoxTab.vue:93
  'surface-root-1e545b8528e7032f':{kind:'view',view:'vented-alignment'}, // MobileBoxTab.vue:107
  'surface-root-67efa6e4f4432666-2':{kind:'partOf',view:'vented-alignment'}, // MobileBoxTab.vue:108
  'surface-root-7641f85f96d8ad93':{kind:'view',view:'losses-sealed-Rear'}, // MobileBoxTab.vue:133
  'surface-root-7c0ea2923930ec2a':{kind:'partOf',view:'losses-sealed-Rear'}, // MobileBoxTab.vue:134
  'conditional-branch-e1c1ad4d5b9e44e3':{kind:'partOf',view:'losses-sealed-Rear'}, // MobileBoxTab.vue:140
  'conditional-branch-e440c02bee223274':{kind:'partOf',view:'losses-sealed-Rear'}, // MobileBoxTab.vue:143
  'conditional-branch-f31d207c488350dc':{kind:'partOf',view:'losses-sealed-Rear'}, // MobileBoxTab.vue:144
  'native-ui-e0bb2079c5bb23c1':{kind:'notAView',reason:'reset button inside the losses dialog'}, // MobileBoxTab.vue:148
  'surface-root-3446d9c7cb1484e9':{kind:'notAView',reason:'hamburger button that opens the app menu'}, // MobileChartView.vue:20
  'native-ui-de37bdac75fa3915':{kind:'notAView',reason:'charts-per-screen select, a control on the Graph page'}, // MobileChartView.vue:27
  'conditional-branch-360b1ce54eee0d71':{kind:'partOf',view:'tab-graph'}, // MobileChartView.vue:35
  'surface-root-fffdafa3e7668767':{kind:'view',view:'chart-picker'}, // MobileChartView.vue:40
  'conditional-branch-95c87e63dded118b':{kind:'partOf',view:'chart-picker'}, // MobileChartView.vue:41
  'conditional-branch-e050febbb6e1d727':{kind:'notAView',reason:'Data chip, a trigger for the chart data dialog'}, // MobileChartView.vue:53
  'surface-root-ddbc0e17254ca99a':{kind:'partOf',view:'tab-graph'}, // MobileChartView.vue:60
  'surface-root-f389519938047484':{kind:'view',view:'tune-sealed'}, // MobileChartView.vue:61
  'surface-root-f389519938047484-2':{kind:'view',view:'what-if-sealed'}, // MobileChartView.vue:62
  'native-ui-2513c3648909d3f9':{kind:'notAView',reason:'Info button, a trigger for the driver info dialog'}, // MobileDriverTab.vue:22
  'conditional-branch-8237e4a04cf22313':{kind:'partOf',view:'box-vented'}, // MobileEnclosureTab.vue:29
  'conditional-branch-c2f58d4c2e63129d':{kind:'partOf',view:'box-vented'}, // MobileEnclosureTab.vue:30
  'conditional-branch-9912810d1d9f756b':{kind:'partOf',view:'box-vented'}, // MobileEnclosureTab.vue:46
  'conditional-branch-b946a3054685a610':{kind:'partOf',view:'box-vented'}, // MobileEnclosureTab.vue:50
  'conditional-branch-28f6e0fea4f7ce2b':{kind:'view',view:'phone/tuning-unreachable-warning'}, // MobileEnclosureTab.vue:54
  'conditional-branch-258660b326ed880e':{kind:'partOf',view:'box-box-passive-radiator'}, // MobileEnclosureTab.vue:57
  'native-ui-7cde39dc2c9cc82b':{kind:'notAView',reason:'Save to library button, a trigger for the save dialog'}, // MobileEnclosureTab.vue:66
  'conditional-branch-19ea85b78eccfeb9':{kind:'view',view:'pr-save'}, // MobileEnclosureTab.vue:68
  'conditional-branch-534f1ce43febe13c':{kind:'view',view:'pr-picker'}, // MobileEnclosureTab.vue:71
  'conditional-branch-4dca507455f940a4':{kind:'partOf',view:'box-vented'}, // MobileEnclosureTab.vue:93
  'conditional-branch-248622210b98b3a7':{kind:'view',view:'phone/filter-card-body'}, // MobileFilterCard.vue:45
  'conditional-branch-4e839ac1a285f175':{kind:'view',view:'filter-lowpass'}, // MobileFilterCard.vue:46
  'conditional-branch-2bd74c11583e97d1':{kind:'view',view:'filter-allpass'}, // MobileFilterCard.vue:47
  'conditional-branch-1aeefefd13a73e41':{kind:'view',view:'filter-linkwitz'}, // MobileFilterCard.vue:48
  'conditional-branch-b838ae7d33be57b5':{kind:'view',view:'filter-peaking'}, // MobileFilterCard.vue:49
  'conditional-branch-04a52f6895f61741':{kind:'view',view:'filter-peakHighpass'}, // MobileFilterCard.vue:50
  'conditional-branch-9833a141381c1e37':{kind:'view',view:'filter-staticGain'}, // MobileFilterCard.vue:51
  'conditional-branch-63d6ab2f686c340c':{kind:'view',view:'filter-raisedCosine'}, // MobileFilterCard.vue:52
  'conditional-branch-bcaa53c9d668d776':{kind:'view',view:'filter-lowshelf'}, // MobileFilterCard.vue:53
  'surface-root-90370dca10477070':{kind:'view',view:'section-help'}, // MobileFilterCard.vue:56
  'conditional-branch-b9c5277f2a6d9b23':{kind:'notAView',reason:'empty-state hint when no filters exist'}, // MobileFiltersTab.vue:32
  'surface-root-5171a26265cb4a5f':{kind:'partOf',view:'wizard-sealed-1'}, // MobileNewProject.vue:147
  'native-ui-68e1b26c6ec552ad':{kind:'notAView',reason:'close button'}, // MobileNewProject.vue:150
  'conditional-branch-2b23ec7e11691250':{kind:'view',view:'wizard-sealed-1'}, // MobileNewProject.vue:163
  'conditional-branch-58736f6b5c8566db':{kind:'partOf',view:'wizard-sealed-1'}, // MobileNewProject.vue:167
  'conditional-branch-823daaa21d686929':{kind:'partOf',view:'wizard-sealed-2'}, // MobileNewProject.vue:168
  'conditional-branch-a475511eae68d4e8':{kind:'view',view:'wizard-sealed-2'}, // MobileNewProject.vue:174
  'conditional-branch-2bdea8c707768ead':{kind:'view',view:'phone/wizard-isobarik-note'}, // MobileNewProject.vue:187
  'conditional-branch-8b07b49310d89c3d':{kind:'view',view:'wizard-sealed-3'}, // MobileNewProject.vue:198
  'conditional-branch-04e32cc2e2adb6d4':{kind:'notAView',reason:'EBP badge value shown or hidden in a row'}, // MobileNewProject.vue:209
  'conditional-branch-b984624ebd5179ce':{kind:'view',view:'wizard-sealed-4'}, // MobileNewProject.vue:217
  'conditional-branch-a50ee3fc71418490':{kind:'view',view:'wizard-vented-4'}, // MobileNewProject.vue:233
  'conditional-branch-012fdc01742c9450':{kind:'view',view:'phone/wizard-vented-volume-warning'}, // MobileNewProject.vue:242
  'conditional-branch-e4f09d4debae5f04':{kind:'view',view:'phone/wizard-vented-tuning-warning'}, // MobileNewProject.vue:244
  'conditional-branch-7f264eb2e75c906b':{kind:'view',view:'wizard-box-passive-radiator-4'}, // MobileNewProject.vue:249
  'conditional-branch-1c761deb93e32b9c':{kind:'view',view:'phone/wizard-passive-radiator-pick-error'}, // MobileNewProject.vue:256
  'conditional-branch-602a5987ee9e20ac':{kind:'partOf',view:'wizard-sealed-4'}, // MobileNewProject.vue:261
  'conditional-branch-c802a79f413910c0':{kind:'partOf',view:'wizard-vented-4'}, // MobileNewProject.vue:264
  'conditional-branch-12de3ccb0ff95e62':{kind:'view',view:'wizard-sealed-5'}, // MobileNewProject.vue:272
  'conditional-branch-9e81705b774dd418':{kind:'notAView',reason:'Next button'}, // MobileNewProject.vue:288
  'conditional-branch-b0e89ab1c43a5551':{kind:'notAView',reason:'Create button'}, // MobileNewProject.vue:289
  'conditional-branch-9dd5943c5dd71dab':{kind:'view',view:'wizard-placement'}, // MobileNewProject.vue:292
  'surface-root-42d21f64e888ff84':{kind:'view',view:'wizard-help'}, // MobileNewProject.vue:293
  'surface-root-e37840e5f229fc18':{kind:'notAView',reason:'shared frame of the pane dialogs; each pane is its own view'}, // MobilePaneDialog.vue:15
  'native-ui-0caa92a797a59786':{kind:'notAView',reason:'close button'}, // MobilePaneDialog.vue:18
  'native-ui-9a535ae222f4b485':{kind:'partOf',view:'menu-projects'}, // MobileProjectsPane.vue:93
  'conditional-branch-37883ed4d37fbe37':{kind:'partOf',view:'menu-projects'}, // MobileProjectsPane.vue:94
  'conditional-branch-3ffe441a08c56960':{kind:'notAView',reason:'search box, a control'}, // MobileProjectsPane.vue:96
  'conditional-branch-db0789b8dfd42212':{kind:'notAView',reason:'empty-state hint'}, // MobileProjectsPane.vue:130
  'conditional-branch-4cb0de4fc5fd7b0a':{kind:'notAView',reason:'no-match hint'}, // MobileProjectsPane.vue:131
  'conditional-branch-02b68a0160abe8fa':{kind:'notAView',reason:'colour swatch button, a trigger'}, // MobileProjectsPane.vue:141
  'conditional-branch-1ec76424c4fb149c':{kind:'notAView',reason:'swatch placeholder when the project is closed'}, // MobileProjectsPane.vue:154
  'conditional-branch-f23a5fea084a08c0':{kind:'notAView',reason:'show/hide toggle in a project row'}, // MobileProjectsPane.vue:158
  'conditional-branch-25d548c8f6fcbdcf':{kind:'notAView',reason:'Open mark in a row'}, // MobileProjectsPane.vue:171
  'conditional-branch-5fcaeb9239eb0c72':{kind:'notAView',reason:'Unsaved mark in a row'}, // MobileProjectsPane.vue:173
  'conditional-branch-86b2bf6b11334fb6':{kind:'notAView',reason:'size text in a row'}, // MobileProjectsPane.vue:179
  'conditional-branch-e18824f42b36119a':{kind:'notAView',reason:'sync mark in a row'}, // MobileProjectsPane.vue:180
  'surface-root-9bdd027160dec7f8':{kind:'notAView',reason:'row Actions button, a trigger for the action sheet'}, // MobileProjectsPane.vue:184
  'conditional-branch-2481737ddaea4217':{kind:'notAView',reason:'footer hint'}, // MobileProjectsPane.vue:196
  'conditional-branch-ba2e3ea88a5a345f':{kind:'view',view:'bin'}, // MobileProjectsPane.vue:208
  'conditional-branch-eef2c1128469222a':{kind:'notAView',reason:'empty-state hint'}, // MobileProjectsPane.vue:209
  'conditional-branch-2ca09a4804ab62d7':{kind:'notAView',reason:'Empty Bin button'}, // MobileProjectsPane.vue:218
  'conditional-branch-63ee35f9f759975b':{kind:'notAView',reason:'button label while the bin is open'}, // MobileProjectsPane.vue:228
  'conditional-branch-739e06f007729aef':{kind:'notAView',reason:'button label while the bin is closed'}, // MobileProjectsPane.vue:229
  'surface-root-2f533998c42291cb':{kind:'view',view:'project-actions'}, // MobileProjectsPane.vue:235
  'surface-root-c8f8ea7ded350054':{kind:'partOf',view:'project-actions'}, // MobileProjectsPane.vue:236
  'surface-root-06eb5b15dcc2ac49':{kind:'partOf',view:'project-actions'}, // MobileProjectsPane.vue:237
  'surface-root-6f93aa471c105a6a':{kind:'partOf',view:'project-actions'}, // MobileProjectsPane.vue:238
  'surface-root-9c2211b19ff98134':{kind:'partOf',view:'project-actions'}, // MobileProjectsPane.vue:240
  'surface-root-22c5f32eb1e6a808':{kind:'partOf',view:'project-actions'}, // MobileProjectsPane.vue:241
  'surface-root-e6543a5a3e1b6bf2':{kind:'partOf',view:'project-actions'}, // MobileProjectsPane.vue:252
  'conditional-branch-577379ba2e7e7b05':{kind:'view',view:'phone/save-note'}, // MobileSaveButton.vue:17
  'surface-root-50ad9addbd868705':{kind:'notAView',reason:'pull-tab, a trigger that opens the sheet'}, // MobileSheet.vue:22
  'surface-root-f0f5f3804ef47a7d':{kind:'view',view:'tune-sealed'}, // MobileSheet.vue:24
  'surface-root-d9522e14c0ea9a34':{kind:'partOf',view:'tune-sealed'}, // MobileSheet.vue:25
  'surface-root-3e2ee38a52c0f3f1':{kind:'partOf',view:'tune-sealed'}, // MobileSheet.vue:29
  'surface-root-0c492f10db9b3f5c':{kind:'partOf',view:'tune-sealed'}, // MobileSheet.vue:30
  'surface-root-36a17bb1f108e7f2':{kind:'view',view:'sheet-port'}, // MobileSheet.vue:36
  'surface-root-ffff2084f2664c76':{kind:'partOf',view:'sheet-port'}, // MobileSheet.vue:37
  'surface-root-79590631b469cebe':{kind:'partOf',view:'sheet-port'}, // MobileSheet.vue:38
  'surface-root-55524a63a6cc0be3':{kind:'partOf',view:'sheet-port'}, // MobileSheet.vue:39
  'surface-root-1b356f0684ae6d38':{kind:'partOf',view:'sheet-port'}, // MobileSheet.vue:41
  'conditional-branch-15eec9fedba15690':{kind:'partOf',view:'sheet-port'}, // MobileSheet.vue:41
  'surface-root-ec3b319abc9006b7':{kind:'partOf',view:'tune-sealed'}, // MobileSheet.vue:43
  'surface-root-0affa49de6296f1b':{kind:'partOf',view:'tune-sealed'}, // MobileSheet.vue:44
  'surface-root-b9845180aea96f79':{kind:'partOf',view:'tune-sealed'}, // MobileSheet.vue:47
  'surface-root-0c90db0680ec61f1':{kind:'notAView',reason:'Reset button'}, // MobileSheet.vue:48
  'surface-root-3fff8b1fa35d21e3':{kind:'notAView',reason:'Close button'}, // MobileSheet.vue:49
  'native-ui-f73795696e179ae2':{kind:'view',view:'native-files'}, // MobileShell.vue:58
  'conditional-branch-cb0350d63ed298af':{kind:'notAView',reason:'top bar chrome, hidden over the Graph page'}, // MobileShell.vue:63
  'conditional-branch-4fc6853003e16cf2':{kind:'notAView',reason:'wrapper that holds the banners back while a Graph sheet is open; the banners are their own views'}, // MobileShell.vue:116
  'native-ui-054db9b28ba37edc':{kind:'notAView',reason:'hamburger button, a trigger for the app menu'}, // MobileShell.vue:64
  'conditional-branch-6b8e5efbbcdd19fe':{kind:'notAView',reason:'project title text'}, // MobileShell.vue:71
  'conditional-branch-e7959648efc88009':{kind:'notAView',reason:'sync indicator in the header'}, // MobileShell.vue:72
  'conditional-branch-00dfcd8995a0bca6':{kind:'notAView',reason:'Save button'}, // MobileShell.vue:81
  'conditional-branch-fe933d179aec15aa':{kind:'notAView',reason:'key strip chrome'}, // MobileShell.vue:84
  'conditional-branch-3d2e2311d91bd6bb':{kind:'view',view:'empty'}, // MobileShell.vue:86
  'conditional-branch-29140a9d9b0a8e39':{kind:'notAView',reason:'skin link'}, // MobileShell.vue:97
  'conditional-branch-733caeff2bf5db5a':{kind:'notAView',reason:'wrapper of the open-project pages'}, // MobileShell.vue:100
  'conditional-branch-7f07f9849b39e03c':{kind:'view',view:'tab-graph'}, // MobileShell.vue:102
  'conditional-branch-95fd0014bb9cdc0c':{kind:'view',view:'box-sealed'}, // MobileShell.vue:103
  'conditional-branch-b12b99398562104d':{kind:'view',view:'tab-driver'}, // MobileShell.vue:104
  'conditional-branch-eb86fe389abbabe9':{kind:'view',view:'tab-signal'}, // MobileShell.vue:105
  'conditional-branch-b5d61b44e76ca6e6':{kind:'view',view:'tab-filters'}, // MobileShell.vue:106
  'conditional-branch-3e9f71ccd76d9070':{kind:'notAView',reason:'spacer under the pages'}, // MobileShell.vue:107
  'conditional-branch-0ea91e151e8dab76':{kind:'view',view:'menu-project-details'}, // MobileShell.vue:109
  'conditional-branch-fcdbb4050a6cf94c':{kind:'view',view:'menu-advanced'}, // MobileShell.vue:112
  'conditional-branch-f40a2f5de1691674':{kind:'view',view:'phone/flash-strip'}, // MobileShell.vue:115
  'conditional-branch-3cdff08e355e12f3':{kind:'view',view:'phone/update-strip'}, // MobileShell.vue:118
  'conditional-branch-87288b8933138f90':{kind:'view',view:'phone/cloud-reconnect-strip'}, // MobileShell.vue:123
  'conditional-branch-6fe61d2be8cac907':{kind:'view',view:'phone/cloud-conflict-notice'}, // MobileShell.vue:128
  'conditional-branch-35b05b46e88c1090':{kind:'view',view:'phone/cloud-hint'}, // MobileShell.vue:132
  'conditional-branch-cbb818c2036c6c93':{kind:'notAView',reason:'tab bar chrome'}, // MobileShell.vue:137
  'conditional-branch-25062a83676537d0':{kind:'view',view:'menu-manage-drivers'}, // MobileShell.vue:142
  'conditional-branch-76cad433425166e9':{kind:'view',view:'cloud'}, // MobileShell.vue:145
  'surface-root-2ef0fa4dc3d7c83c':{kind:'view',view:'menu'}, // MobileShell.vue:158
  'surface-root-58da7ceecc4b293b':{kind:'partOf',view:'menu'}, // MobileShell.vue:159
  'surface-root-ab74fb004e24587e':{kind:'partOf',view:'menu'}, // MobileShell.vue:160
  'surface-root-f5b4d75c21482ee5':{kind:'partOf',view:'menu'}, // MobileShell.vue:162
  'surface-root-3f7ea97247170aaa':{kind:'partOf',view:'menu'}, // MobileShell.vue:163
  'surface-root-3abf420cfda3db1b':{kind:'partOf',view:'menu'}, // MobileShell.vue:164
  'surface-root-64b94db53fbeaa65':{kind:'partOf',view:'menu'}, // MobileShell.vue:165
  'surface-root-cba80a35c6e7b007':{kind:'partOf',view:'menu'}, // MobileShell.vue:167
  'surface-root-c9cab78489a8d82d':{kind:'partOf',view:'menu'}, // MobileShell.vue:171
  'surface-root-36134d015c97d9fd':{kind:'partOf',view:'menu'}, // MobileShell.vue:172
  'conditional-branch-7b1aaef0e4c7577f':{kind:'partOf',view:'menu'}, // MobileShell.vue:174
  'native-ui-90f9472d457836c0':{kind:'notAView',reason:'trace show/hide button in a menu row'}, // MobileShell.vue:176
  'native-ui-c2796d097da999e9':{kind:'notAView',reason:'colour button in a menu row'}, // MobileShell.vue:180
  'conditional-branch-841c5b8a0744107c':{kind:'partOf',view:'menu'}, // MobileShell.vue:183
  'surface-root-1df8abb2914eae8d':{kind:'partOf',view:'menu'}, // MobileShell.vue:190
  'surface-root-40d6006cb3126bec':{kind:'partOf',view:'menu'}, // MobileShell.vue:191
  'surface-root-27b6d607b0b7e803':{kind:'partOf',view:'menu'}, // MobileShell.vue:192
  'surface-root-27b6d607b0b7e803-2':{kind:'partOf',view:'menu'}, // MobileShell.vue:193
  'surface-root-27b6d607b0b7e803-3':{kind:'partOf',view:'menu'}, // MobileShell.vue:194
  'conditional-branch-f1b1f9f5af042443':{kind:'partOf',view:'menu'}, // MobileShell.vue:196
  'surface-root-27b6d607b0b7e803-4':{kind:'partOf',view:'menu'}, // MobileShell.vue:197
  'surface-root-27b6d607b0b7e803-5':{kind:'partOf',view:'menu'}, // MobileShell.vue:198
  'surface-root-c97c83fb260005dc':{kind:'partOf',view:'menu'}, // MobileShell.vue:199
  'surface-root-e20e51a391f113dd':{kind:'partOf',view:'menu'}, // MobileShell.vue:200
  'surface-root-27b6d607b0b7e803-6':{kind:'partOf',view:'menu'}, // MobileShell.vue:201
  'surface-root-27b6d607b0b7e803-7':{kind:'partOf',view:'menu'}, // MobileShell.vue:202
  'surface-root-1df8abb2914eae8d-2':{kind:'partOf',view:'menu'}, // MobileShell.vue:205
  'surface-root-2dd13cdc019adcdd':{kind:'partOf',view:'menu'}, // MobileShell.vue:206
  'surface-root-27b6d607b0b7e803-8':{kind:'partOf',view:'menu'}, // MobileShell.vue:207
  'surface-root-27b6d607b0b7e803-9':{kind:'partOf',view:'menu'}, // MobileShell.vue:208
  'surface-root-e3d4c325134b32e5':{kind:'partOf',view:'menu'}, // MobileShell.vue:209
  'surface-root-694912a9cc2280a0':{kind:'partOf',view:'menu'}, // MobileShell.vue:211
  'surface-root-27b6d607b0b7e803-10':{kind:'partOf',view:'menu'}, // MobileShell.vue:216
  'surface-root-27b6d607b0b7e803-11':{kind:'partOf',view:'menu'}, // MobileShell.vue:217
  'surface-root-27b6d607b0b7e803-12':{kind:'partOf',view:'menu'}, // MobileShell.vue:218
  'surface-root-27b6d607b0b7e803-13':{kind:'partOf',view:'menu'}, // MobileShell.vue:219
  'surface-root-27b6d607b0b7e803-14':{kind:'partOf',view:'menu'}, // MobileShell.vue:220
  'surface-root-42c53930f10ad1ce':{kind:'partOf',view:'menu'}, // MobileShell.vue:221
  'conditional-branch-1eb218e520d0e53c':{kind:'view',view:'menu-projects'}, // MobileShell.vue:227
  'surface-root-600e0121a9217f4e':{kind:'view',view:'options-general'}, // MobileShell.vue:260
  'conditional-branch-6bc3e952f142d178':{kind:'notAView',reason:'help button, a trigger for the section help'}, // PhoneBand.vue:20
  'surface-root-1513d1f440513c79':{kind:'view',view:'section-help'}, // PhoneBand.vue:22
  'surface-root-9abe6e125bb518d6':{kind:'view',view:'section-help'}, // PhoneHelpSheet.vue:21
  'surface-root-5dfbbcb405010bcd':{kind:'partOf',view:'section-help'}, // PhoneHelpSheet.vue:22
  'conditional-branch-ef863c233116e5ea':{kind:'partOf',view:'section-help'}, // PhoneHelpSheet.vue:28
  'conditional-branch-543827f4686073bc':{kind:'partOf',view:'section-help'}, // PhoneHelpSheet.vue:29
};
