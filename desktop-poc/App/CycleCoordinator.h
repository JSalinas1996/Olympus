#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef void (^OlympusProgressHandler)(NSDictionary *detail);
typedef BOOL (^OlympusCancellationCheck)(void);

NSDictionary * _Nullable OlympusRunFileCycle(NSDictionary *payload, OlympusProgressHandler progress, OlympusCancellationCheck cancelled, NSError **error);
NSNumber * _Nullable OlympusScoreFromEvaluation(NSString *evaluation);

NS_ASSUME_NONNULL_END
