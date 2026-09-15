#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

NSString *OlympusNormalizeModelLabel(NSString *value);
BOOL OlympusModelLabelMatches(NSString *actualLabel, NSString *model, NSString *effort);
BOOL OlympusEnsureModelSelection(NSString *bundleIdentifier, NSDictionary *selection, NSError **error);

NS_ASSUME_NONNULL_END
