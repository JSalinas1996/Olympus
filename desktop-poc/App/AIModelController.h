#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

NSString *OlympusNormalizeModelLabel(NSString *value);
BOOL OlympusModelLabelMatches(NSString *actualLabel, NSString *model, NSString *effort);
BOOL OlympusModelFamilyMatchesLabel(NSString *actualLabel, NSString *family);
NSComparisonResult OlympusCompareModelVersions(NSString *leftLabel, NSString *rightLabel, NSString *family);
NSString * _Nullable OlympusBestModelLabel(NSArray<NSString *> *labels, NSString *family);
BOOL OlympusEnsureModelSelection(NSString *bundleIdentifier, NSDictionary *selection, NSDictionary * _Nullable * _Nullable resolvedSelection, NSError **error);

NS_ASSUME_NONNULL_END
